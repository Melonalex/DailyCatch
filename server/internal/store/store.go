package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"dailycatch/server/internal/config"
)

type Issue struct {
	Date         string  `json:"date"`
	Title        *string `json:"title"`
	ArticleType  *string `json:"article_type"`
	Difficulty   *string `json:"difficulty"`
	Topic        *string `json:"topic"`
}

type Lesson struct {
	ArticleType string `json:"article_type"`
	Difficulty  string `json:"difficulty"`
	Topic       string `json:"topic"`
	Title       string `json:"title"`
	Paragraphs  any    `json:"paragraphs"`
	Translation any    `json:"translation"`
	Vocabulary  any    `json:"vocabulary"`
}

type HotTopic struct {
	ID         int64   `json:"id"`
	Title      string  `json:"title"`
	Overview   string  `json:"overview"`
	Quotes     any     `json:"quotes"`
	Background *string `json:"background"`
}

type Item struct {
	ID              int64   `json:"id"`
	SourceType      string  `json:"source_type"`
	SourceName      string  `json:"source_name"`
	Title           string  `json:"title"`
	URL             string  `json:"url"`
	Author          *string `json:"author"`
	Points          *int64  `json:"points"`
	CommentCount    *int64  `json:"comment_count"`
	PublishedAt     *string `json:"published_at"`
	Summary         *string `json:"summary"`
	Vocabulary      any     `json:"vocabulary"`
	CommentsDigest  any     `json:"comments_digest"`
}

type Digest struct {
	Date      string     `json:"date"`
	Lesson    *Lesson    `json:"lesson"`
	HotTopics []HotTopic `json:"hot_topics"`
	Items     []Item     `json:"items"`
}

func Open(settings config.Settings) (*sql.DB, error) {
	cfg := mysql.Config{
		User:                 settings.DBUser,
		Passwd:               settings.DBPassword,
		Net:                  "tcp",
		Addr:                 fmt.Sprintf("%s:%d", settings.DBHost, settings.DBPort),
		DBName:               settings.DBName,
		ParseTime:            true,
		Collation:            "utf8mb4_unicode_ci",
		AllowNativePasswords: true,
		Params:               map[string]string{"charset": "utf8mb4"},
	}
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(8)
	return db, nil
}

func EnsureSchema(ctx context.Context, db *sql.DB, path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	for _, statement := range statements(string(raw)) {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func ListDates(ctx context.Context, db *sql.DB) ([]Issue, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT issues.digest_date, lessons.title, lessons.article_type,
		       lessons.difficulty, lessons.topic
		FROM (
		  SELECT digest_date FROM articles
		  UNION
		  SELECT digest_date FROM lessons
		) AS issues
		LEFT JOIN lessons ON lessons.digest_date = issues.digest_date
		ORDER BY issues.digest_date DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	issues := []Issue{}
	for rows.Next() {
		var day time.Time
		var title, articleType, difficulty, topic sql.NullString
		if err := rows.Scan(&day, &title, &articleType, &difficulty, &topic); err != nil {
			return nil, err
		}
		issues = append(issues, Issue{
			Date:        day.Format("2006-01-02"),
			Title:       nullString(title),
			ArticleType: nullString(articleType),
			Difficulty:  nullString(difficulty),
			Topic:       nullString(topic),
		})
	}
	return issues, rows.Err()
}

func LoadDigest(ctx context.Context, db *sql.DB, day time.Time) (Digest, bool, error) {
	lesson, err := loadLesson(ctx, db, day)
	if err != nil {
		return Digest{}, false, err
	}
	topics, err := loadTopics(ctx, db, day)
	if err != nil {
		return Digest{}, false, err
	}
	items, err := loadItems(ctx, db, day)
	if err != nil {
		return Digest{}, false, err
	}
	found := lesson != nil || len(topics) > 0 || len(items) > 0
	return Digest{
		Date:      day.Format("2006-01-02"),
		Lesson:    lesson,
		HotTopics: topics,
		Items:     items,
	}, found, nil
}

func LessonExists(ctx context.Context, db *sql.DB, day time.Time) (bool, error) {
	var one int
	err := db.QueryRowContext(ctx, `SELECT 1 FROM lessons WHERE digest_date = ?`, day.Format("2006-01-02")).Scan(&one)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func loadLesson(ctx context.Context, db *sql.DB, day time.Time) (*Lesson, error) {
	var lesson Lesson
	var body, translation, vocabulary []byte
	err := db.QueryRowContext(ctx, `
		SELECT article_type, difficulty, topic, title, body, translation, vocabulary
		FROM lessons WHERE digest_date = ?`, day.Format("2006-01-02")).
		Scan(&lesson.ArticleType, &lesson.Difficulty, &lesson.Topic, &lesson.Title, &body, &translation, &vocabulary)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	lesson.Paragraphs = decodeList(body)
	lesson.Translation = decodeList(translation)
	lesson.Vocabulary = decodeList(vocabulary)
	return &lesson, nil
}

func loadTopics(ctx context.Context, db *sql.DB, day time.Time) ([]HotTopic, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, title, overview, quotes, background
		FROM hot_topics WHERE digest_date = ?
		ORDER BY sort_order, id`, day.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	topics := []HotTopic{}
	for rows.Next() {
		var topic HotTopic
		var quotes []byte
		var background sql.NullString
		if err := rows.Scan(&topic.ID, &topic.Title, &topic.Overview, &quotes, &background); err != nil {
			return nil, err
		}
		topic.Quotes = decodeList(quotes)
		topic.Background = nullString(background)
		topics = append(topics, topic)
	}
	return topics, rows.Err()
}

func loadItems(ctx context.Context, db *sql.DB, day time.Time) ([]Item, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, source_type, source_name, title, url, author, points,
		       comment_count, published_at, summary, vocabulary, comments_digest
		FROM articles WHERE digest_date = ?
		ORDER BY source_type, source_name, id`, day.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Item{}
	for rows.Next() {
		var item Item
		var author, summary sql.NullString
		var points, comments sql.NullInt64
		var published sql.NullTime
		var vocabulary, digest []byte
		if err := rows.Scan(
			&item.ID, &item.SourceType, &item.SourceName, &item.Title, &item.URL,
			&author, &points, &comments, &published, &summary, &vocabulary, &digest,
		); err != nil {
			return nil, err
		}
		item.Author = nullString(author)
		item.Points = nullInt(points)
		item.CommentCount = nullInt(comments)
		item.PublishedAt = nullTime(published)
		item.Summary = nullString(summary)
		item.Vocabulary = decodeAny(vocabulary)
		item.CommentsDigest = decodeAny(digest)
		items = append(items, item)
	}
	return items, rows.Err()
}

func decodeList(raw []byte) any {
	value := decodeAny(raw)
	if value == nil {
		return []any{}
	}
	return value
}

func decodeAny(raw []byte) any {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil
	}
	return value
}

func nullString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func nullInt(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func nullTime(value sql.NullTime) *string {
	if !value.Valid {
		return nil
	}
	text := value.Time.Format("2006-01-02 15:04:05")
	return &text
}

func statements(sqlText string) []string {
	var lines []string
	for _, line := range strings.Split(sqlText, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		lines = append(lines, line)
	}
	var out []string
	for _, part := range strings.Split(strings.Join(lines, "\n"), ";") {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}
