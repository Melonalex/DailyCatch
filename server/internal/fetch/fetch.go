package fetch

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"time"

	"dailycatch/server/internal/config"
)

type Story struct {
	SourceType   string
	SourceName   string
	Title        string
	URL          string
	Author       string
	Points       *int
	CommentCount *int
	PublishedAt  *time.Time
	Excerpt      string
	Comments     []Comment
}

type Comment struct {
	Author string
	Text   string
	Points int
}

func Run(ctx context.Context, db *sql.DB, settings config.Settings, day time.Time, useAI bool) error {
	if _, err := db.ExecContext(ctx, `DELETE FROM articles WHERE digest_date = ?`, day.Format("2006-01-02")); err != nil {
		return err
	}
	log.Printf("Cleared digest %s", day.Format("2006-01-02"))

	var stories []Story
	hn, err := HackerNews(ctx, 10)
	if err != nil {
		log.Printf("Hacker News fetch failed: %v", err)
	} else {
		stories = append(stories, hn...)
	}
	rss, err := RSS(ctx, settings.Feeds)
	if err != nil {
		log.Printf("RSS fetch failed: %v", err)
	} else {
		stories = append(stories, rss...)
	}

	stored := map[string]int{}
	for _, story := range stories {
		ok, err := storeStory(ctx, db, day, story)
		if err != nil {
			log.Printf("Failed to store %s: %v", story.URL, err)
			continue
		}
		if ok {
			stored[story.SourceType]++
		}
	}
	lessonStatus := "skipped"
	hotTopics := 0
	if useAI && settings.DeepSeekKey != "" && stored["hackernews"]+stored["rss"] > 0 {
		lesson, err := Compose(ctx, db, settings.DeepSeekKey, day, stories)
		if err != nil || lesson == nil {
			log.Printf("Lesson request failed: %v", err)
			lessonStatus = "failed"
		} else if count, err := SaveLesson(ctx, db, day, lesson); err != nil {
			log.Printf("Failed to store the lesson: %v", err)
			lessonStatus = "failed"
		} else {
			lessonStatus = "ok"
			hotTopics = count
		}
	} else if useAI && settings.DeepSeekKey == "" {
		log.Printf("DEEPSEEK_API_KEY is empty; storing items without AI fields")
	}
	log.Printf("stored hackernews=%d rss=%d lesson=%s hot_topics=%d", stored["hackernews"], stored["rss"], lessonStatus, hotTopics)
	if stored["hackernews"]+stored["rss"] == 0 {
		return fmt.Errorf("no stories stored")
	}
	return nil
}

func storeStory(ctx context.Context, db *sql.DB, day time.Time, story Story) (bool, error) {
	title := clip(story.Title, 512)
	url := clip(story.URL, 1024)
	source := clip(story.SourceName, 64)
	if title == "" || url == "" || source == "" {
		return false, nil
	}
	sum := sha256.Sum256([]byte(url))
	var published any
	if story.PublishedAt != nil {
		published = story.PublishedAt.UTC()
	}
	_, err := db.ExecContext(ctx, `
		INSERT INTO articles (
		  digest_date, source_type, source_name, title, url, url_hash,
		  author, points, comment_count, published_at,
		  summary, vocabulary, comments_digest
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
		day.Format("2006-01-02"), story.SourceType, source, title, url, hex.EncodeToString(sum[:]),
		nullText(story.Author, 128), intPtr(story.Points), intPtr(story.CommentCount), published,
	)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate") {
		log.Printf("Duplicate url skipped: %s", url)
		return false, nil
	}
	return err == nil, err
}

func clip(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len(value) > limit {
		return value[:limit]
	}
	return value
}

func nullText(value string, limit int) any {
	value = clip(value, limit)
	if value == "" {
		return nil
	}
	return value
}

func intPtr(value *int) any {
	if value == nil {
		return nil
	}
	return *value
}
