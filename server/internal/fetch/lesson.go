package fetch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"database/sql"
)

const deepSeekURL = "https://api.deepseek.com/chat/completions"

type spec struct {
	difficulty  string
	words       string
	topics      []string
	instruction string
}

var typeOrder = []string{"ielts", "daily", "tech", "news"}

var typeSpecs = map[string]spec{
	"ielts": {
		difficulty: "IELTS 6.5-7.5",
		words:      "560-820",
		topics:     []string{"education", "technology", "society", "environment", "workplace"},
		instruction: "Write an original short story at IELTS 6.5-7.5. " +
			"One person, one place, a problem, a turn, and an ending. " +
			"The argument belongs inside the story, not in a lecture after it. " +
			"Formal, clear, and idiomatic. Do not retell the supplied news.",
	},
	"daily": {
		difficulty: "Everyday English",
		words:      "480-700",
		topics:     []string{"home", "commute", "food", "weekend", "shopping", "neighbors"},
		instruction: "Write an original everyday short story. " +
			"A full scene, several lines of spoken dialogue, a small problem, and a quiet ending. " +
			"Use common spoken vocabulary. Do not retell the supplied news.",
	},
	"tech": {
		difficulty: "Upper-intermediate technology",
		words:      "560-820",
		topics:     []string{"artificial intelligence", "programming", "the internet", "developer work"},
		instruction: "Write an original short story for a reader who studies computer science. " +
			"Follow one person through a working day. The technical idea is what they run into, " +
			"not a textbook section after the scene. Do not retell the supplied news.",
	},
	"news": {
		difficulty: "News English",
		words:      "420-620",
		topics:     []string{"current events"},
		instruction: "Write a medium-short news account using only the supplied items. " +
			"You may follow the events in time and quote the supplied comments. " +
			"Do not invent a character, a scene, a motive, a number, or any fact that is not in the items.",
	},
}

const systemPrompt = "You write one English study article and a short list of hot topics. " +
	"Return one JSON object with keys article_type, difficulty, topic, title, paragraphs, " +
	"translation, vocabulary, hot_topics. " +
	"Follow the requested article_type, topic, difficulty, and word range. " +
	"Count words in the English paragraphs only. A piece under the minimum is incomplete; do not stop early. " +
	"title is at most 8 words. " +
	"paragraphs is 6 to 9 English paragraphs. " +
	"translation is the same number of paragraphs, a faithful Chinese translation, with no extra commentary. " +
	"vocabulary has 5 to 8 entries from the article. Each entry has word, pos, meaning, usage, and contrast. " +
	"pos is a short grammar label such as n. or verb. " +
	"meaning is a short Chinese gloss. usage is a natural English collocation. " +
	"contrast is an empty string, or one short note when the word is easily confused, in English plus a Chinese gloss. " +
	"hot_topics has 1 entry by default and at most 3, ranked from the most discussed to the least. " +
	"Add a second or third topic only for another major international, technology, chip, or corporate event in the items. " +
	"Each hot topic has title, overview, quotes, and background. " +
	"title and overview are English. The overview must name the date, the actor, and the source. " +
	"quotes has 2 to 4 items taken only from supplied comments or excerpts. " +
	"Each quote has text, speaker, source_type, and stance. " +
	"source_type is one of: CEO statement, Public figure, Analyst, Public reaction. " +
	"stance is one of: Support, Doubt, Aside. " +
	"text must stay close to the supplied wording and must not invent a speaker. " +
	"background is one or two short Chinese sentences of context, not a full translation. " +
	"Never invent an event, a person, a number, or a quotation."

type assignment struct {
	ArticleType string `json:"article_type"`
	Topic       string `json:"topic"`
	Difficulty  string `json:"difficulty"`
	Words       string `json:"words"`
	Instruction string `json:"instruction"`
}

type lessonDoc struct {
	ArticleType string
	Difficulty  string
	Topic       string
	Title       string
	Paragraphs  []string
	Translation []string
	Vocabulary  []map[string]string
	HotTopics   []hotTopic
}

type hotTopic struct {
	Title      string
	Overview   string
	Quotes     []map[string]string
	Background string
}

func Compose(ctx context.Context, db *sql.DB, apiKey string, day time.Time, stories []Story) (*lessonDoc, error) {
	assigned, err := assignmentFor(ctx, db, day)
	if err != nil {
		return nil, err
	}
	log.Printf("Lesson assignment %s / %s / %s", assigned.ArticleType, assigned.Topic, assigned.Difficulty)
	payload, err := json.Marshal(map[string]any{
		"assignment": assigned,
		"items":      materials(stories),
	})
	if err != nil {
		return nil, err
	}
	body := map[string]any{
		"model":           "deepseek-chat",
		"temperature":     0.3,
		"response_format": map[string]string{"type": "json_object"},
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": string(payload)},
		},
	}
	content, err := postLesson(ctx, apiKey, body)
	if err != nil {
		return nil, err
	}
	lesson := parseLesson(content, assigned)
	if lesson == nil {
		return nil, fmt.Errorf("lesson response was unusable")
	}
	count := wordCount(lesson.Paragraphs)
	minimum := minimumWords(assigned.Words)
	if minimum > 0 && count < minimum {
		log.Printf("Lesson is short (%d words, minimum %d); retrying once", count, minimum)
		retryContent, err := postLesson(ctx, apiKey, body)
		if err == nil {
			if retry := parseLesson(retryContent, assigned); retry != nil && wordCount(retry.Paragraphs) > count {
				return retry, nil
			}
		}
	}
	return lesson, nil
}

func SaveLesson(ctx context.Context, db *sql.DB, day time.Time, lesson *lessonDoc) (int, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	dateText := day.Format("2006-01-02")
	if _, err := tx.ExecContext(ctx, `DELETE FROM hot_topics WHERE digest_date = ?`, dateText); err != nil {
		return 0, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM lessons WHERE digest_date = ?`, dateText); err != nil {
		return 0, err
	}
	body, _ := json.Marshal(lesson.Paragraphs)
	var translation, vocabulary any
	if len(lesson.Translation) > 0 {
		raw, _ := json.Marshal(lesson.Translation)
		translation = string(raw)
	}
	if len(lesson.Vocabulary) > 0 {
		raw, _ := json.Marshal(lesson.Vocabulary)
		vocabulary = string(raw)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO lessons (
		  digest_date, article_type, difficulty, topic, title, body, translation, vocabulary
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		dateText, lesson.ArticleType, lesson.Difficulty, lesson.Topic, lesson.Title,
		string(body), translation, vocabulary,
	); err != nil {
		return 0, err
	}
	for index, topic := range lesson.HotTopics {
		var quotes any
		if len(topic.Quotes) > 0 {
			raw, _ := json.Marshal(topic.Quotes)
			quotes = string(raw)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO hot_topics (
			  digest_date, sort_order, title, overview, quotes, background
			) VALUES (?, ?, ?, ?, ?, ?)`,
			dateText, index, clip(topic.Title, 256), topic.Overview, quotes, emptyNil(topic.Background),
		); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return len(lesson.HotTopics), nil
}

func assignmentFor(ctx context.Context, db *sql.DB, day time.Time) (assignment, error) {
	dateText := day.Format("2006-01-02")
	var articleType, topic sql.NullString
	err := db.QueryRowContext(ctx, `SELECT article_type, topic FROM lessons WHERE digest_date = ?`, dateText).
		Scan(&articleType, &topic)
	if err == nil && articleType.Valid && typeSpecs[articleType.String].difficulty != "" {
		return finishAssignment(articleType.String, topic.String), nil
	}
	if err != nil && err != sql.ErrNoRows {
		return assignment{}, err
	}
	var previousType, previousTopic sql.NullString
	err = db.QueryRowContext(ctx, `
		SELECT article_type, topic FROM lessons
		WHERE digest_date <> ?
		ORDER BY digest_date DESC LIMIT 1`, dateText).Scan(&previousType, &previousTopic)
	if err != nil && err != sql.ErrNoRows {
		return assignment{}, err
	}
	nextType, nextTopic := nextPair(ctx, db, previousType.String)
	return finishAssignment(nextType, nextTopic), nil
}

func finishAssignment(articleType, topic string) assignment {
	chosen := typeSpecs[articleType]
	if !contains(chosen.topics, topic) {
		topic = chosen.topics[0]
	}
	return assignment{
		ArticleType: articleType,
		Topic:       topic,
		Difficulty:  chosen.difficulty,
		Words:       chosen.words,
		Instruction: chosen.instruction,
	}
}

func nextPair(ctx context.Context, db *sql.DB, previousType string) (string, string) {
	if _, ok := typeSpecs[previousType]; !ok {
		return "ielts", typeSpecs["ielts"].topics[0]
	}
	index := 0
	for i, name := range typeOrder {
		if name == previousType {
			index = (i + 1) % len(typeOrder)
		}
	}
	nextType := typeOrder[index]
	topics := typeSpecs[nextType].topics
	var last sql.NullString
	_ = db.QueryRowContext(ctx, `
		SELECT topic FROM lessons WHERE article_type = ?
		ORDER BY digest_date DESC LIMIT 1`, nextType).Scan(&last)
	if last.Valid && contains(topics, last.String) {
		at := 0
		for i, topic := range topics {
			if topic == last.String {
				at = (i + 1) % len(topics)
			}
		}
		return nextType, topics[at]
	}
	return nextType, topics[0]
}

func postLesson(ctx context.Context, apiKey string, body map[string]any) (string, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	var last error
	for attempt := 1; attempt <= httpRetries+1; attempt++ {
		reqCtx, cancel := context.WithTimeout(ctx, 180*time.Second)
		req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, deepSeekURL, bytes.NewReader(raw))
		if err != nil {
			cancel()
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")
		response, err := http.DefaultClient.Do(req)
		if err != nil {
			cancel()
			last = err
		} else {
			payload, readErr := io.ReadAll(response.Body)
			response.Body.Close()
			cancel()
			if readErr != nil {
				last = readErr
			} else if response.StatusCode >= 400 {
				last = fmt.Errorf("HTTP %d from DeepSeek", response.StatusCode)
			} else {
				var parsed struct {
					Choices []struct {
						Message struct {
							Content string `json:"content"`
						} `json:"message"`
					} `json:"choices"`
				}
				if err := json.Unmarshal(payload, &parsed); err != nil {
					return "", err
				}
				if len(parsed.Choices) == 0 {
					return "", fmt.Errorf("DeepSeek returned no choices")
				}
				return parsed.Choices[0].Message.Content, nil
			}
		}
		log.Printf("Lesson request failed (%d/%d): %v", attempt, httpRetries+1, last)
		if attempt <= httpRetries {
			time.Sleep(500 * time.Millisecond)
		}
	}
	return "", last
}

func parseLesson(content string, assigned assignment) *lessonDoc {
	var data map[string]any
	if err := json.Unmarshal([]byte(content), &data); err != nil {
		log.Printf("Lesson response was not valid JSON")
		return nil
	}
	title := clean(data["title"])
	paragraphs := stringList(data["paragraphs"])
	if title == "" || len(paragraphs) == 0 {
		log.Printf("Lesson title or paragraphs are missing")
		return nil
	}
	if len(paragraphs) > 9 {
		paragraphs = paragraphs[:9]
	}
	translation := stringList(data["translation"])
	if len(translation) != len(paragraphs) {
		log.Printf("Lesson translation does not match the paragraphs")
		translation = nil
	} else if len(translation) > 9 {
		translation = translation[:9]
	}
	return &lessonDoc{
		ArticleType: assigned.ArticleType,
		Difficulty:  assigned.Difficulty,
		Topic:       assigned.Topic,
		Title:       clip(title, 256),
		Paragraphs:  paragraphs,
		Translation: translation,
		Vocabulary:  vocabulary(data["vocabulary"]),
		HotTopics:   hotTopics(data["hot_topics"]),
	}
}

func materials(stories []Story) []map[string]any {
	var items []map[string]any
	for _, story := range stories {
		var comments []map[string]string
		for _, comment := range story.Comments {
			text := clean(comment.Text)
			if text == "" {
				continue
			}
			if len(comments) == 5 {
				break
			}
			comments = append(comments, map[string]string{"author": comment.Author, "text": clip(text, 500)})
		}
		published := ""
		if story.PublishedAt != nil {
			published = story.PublishedAt.UTC().Format("2006-01-02 15:04")
		}
		var points any
		if story.Points != nil {
			points = *story.Points
		}
		items = append(items, map[string]any{
			"title":        story.Title,
			"source":       story.SourceName,
			"url":          story.URL,
			"published_at": published,
			"points":       points,
			"excerpt":      clip(clean(story.Excerpt), 600),
			"comments":     comments,
		})
	}
	return items
}

func vocabulary(value any) []map[string]string {
	entries, _ := value.([]any)
	var cleaned []map[string]string
	for _, entry := range entries {
		object, _ := entry.(map[string]any)
		word, meaning := clean(object["word"]), clean(object["meaning"])
		if word == "" || meaning == "" {
			continue
		}
		cleaned = append(cleaned, map[string]string{
			"word": word, "pos": clean(object["pos"]), "meaning": meaning,
			"usage": clean(object["usage"]), "contrast": clean(object["contrast"]),
		})
		if len(cleaned) == 8 {
			break
		}
	}
	if len(cleaned) < 5 || len(cleaned) > 8 {
		log.Printf("Lesson vocabulary has %d entries", len(cleaned))
	}
	return cleaned
}

func hotTopics(value any) []hotTopic {
	entries, _ := value.([]any)
	var topics []hotTopic
	for _, entry := range entries {
		object, _ := entry.(map[string]any)
		title, overview := clean(object["title"]), clean(object["overview"])
		if title == "" || overview == "" {
			continue
		}
		topics = append(topics, hotTopic{
			Title: title, Overview: overview, Quotes: quotes(object["quotes"]), Background: clean(object["background"]),
		})
		if len(topics) == 3 {
			break
		}
	}
	if len(topics) == 0 {
		log.Printf("No usable hot topic was returned")
	}
	return topics
}

func quotes(value any) []map[string]string {
	entries, _ := value.([]any)
	var out []map[string]string
	for _, entry := range entries {
		object, _ := entry.(map[string]any)
		text := strings.TrimSpace(strings.TrimLeft(clean(object["text"]), ">"))
		text = clean(text)
		if text == "" {
			continue
		}
		speaker := clean(object["speaker"])
		if speaker == "" {
			speaker = "unknown"
		}
		out = append(out, map[string]string{
			"text":        text,
			"speaker":     speaker,
			"source_type": choice(object["source_type"], []string{"CEO statement", "Public figure", "Analyst", "Public reaction"}, "Public reaction"),
			"stance":      choice(object["stance"], []string{"Support", "Doubt", "Aside"}, "Aside"),
		})
		if len(out) == 4 {
			break
		}
	}
	return out
}

func choice(value any, allowed []string, fallback string) string {
	text := clean(value)
	if contains(allowed, text) {
		return text
	}
	return fallback
}

func stringList(value any) []string {
	if text, ok := value.(string); ok {
		value = []any{text}
	}
	items, _ := value.([]any)
	var out []string
	for _, item := range items {
		if text := clean(item); text != "" {
			out = append(out, text)
		}
	}
	return out
}

func clean(value any) string {
	text, _ := value.(string)
	text = strings.Join(strings.Fields(text), " ")
	return text
}

func wordCount(paragraphs []string) int {
	return len(strings.Fields(strings.Join(paragraphs, " ")))
}

func minimumWords(spec string) int {
	low, _, _ := strings.Cut(spec, "-")
	number, err := strconvAtoi(strings.TrimSpace(low))
	if err != nil {
		return 0
	}
	return number * 9 / 10
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func emptyNil(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func strconvAtoi(value string) (int, error) {
	var number int
	for _, digit := range value {
		if digit < '0' || digit > '9' {
			return 0, fmt.Errorf("not a number")
		}
		number = number*10 + int(digit-'0')
	}
	if value == "" {
		return 0, fmt.Errorf("not a number")
	}
	return number, nil
}
