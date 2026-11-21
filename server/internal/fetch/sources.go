package fetch

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"dailycatch/server/internal/config"
)

const (
	hnSearch         = "https://hn.algolia.com/api/v1/search"
	commentMaxChars  = 500
	commentFetch     = 50
	commentKeep      = 5
	rssExcerptChars  = 1500
	rssMaxAge        = 48 * time.Hour
	itemsPerFeed     = 5
	httpTimeout      = 10 * time.Second
	httpRetries      = 2
)

var tags = regexp.MustCompile(`<[^>]+>`)

func HackerNews(ctx context.Context, limit int) ([]Story, error) {
	hits, err := getJSON(ctx, hnSearch, url.Values{
		"tags":        {"front_page"},
		"hitsPerPage": {itoa(max(limit*3, 30))},
	})
	if err != nil {
		return nil, err
	}
	var stories []Story
	for _, hit := range objectList(hits["hits"]) {
		link := strings.TrimSpace(stringField(hit, "url"))
		title := plain(stringField(hit, "title"))
		if link == "" || title == "" {
			continue
		}
		story := Story{
			SourceType:   "hackernews",
			SourceName:   "Hacker News",
			Title:        clip(title, 512),
			URL:          clip(link, 1024),
			Author:       stringField(hit, "author"),
			Points:       intField(hit, "points"),
			CommentCount: intField(hit, "num_comments"),
			PublishedAt:  hnTime(stringField(hit, "created_at")),
		}
		if id := stringField(hit, "objectID"); id != "" {
			comments, err := commentsFor(ctx, id)
			if err != nil {
				log.Printf("Failed to fetch comments for story %s: %v", id, err)
			} else {
				story.Comments = comments
			}
		}
		stories = append(stories, story)
		if len(stories) >= limit {
			break
		}
	}
	log.Printf("Fetched %d Hacker News stories", len(stories))
	return stories, nil
}

func commentsFor(ctx context.Context, storyID string) ([]Comment, error) {
	hits, err := getJSON(ctx, hnSearch, url.Values{
		"tags":        {"comment,story_" + storyID},
		"hitsPerPage": {itoa(commentFetch)},
	})
	if err != nil {
		return nil, err
	}
	var comments []Comment
	for _, hit := range objectList(hits["hits"]) {
		text := plain(stringField(hit, "comment_text"))
		if text == "" {
			continue
		}
		points := 0
		if value := intField(hit, "points"); value != nil {
			points = *value
		}
		comments = append(comments, Comment{
			Author: strings.TrimSpace(stringField(hit, "author")),
			Text:   clip(text, commentMaxChars),
			Points: points,
		})
	}
	sort.SliceStable(comments, func(i, j int) bool { return comments[i].Points > comments[j].Points })
	if len(comments) > commentKeep {
		comments = comments[:commentKeep]
	}
	return comments, nil
}

func RSS(ctx context.Context, feeds []config.Feed) ([]Story, error) {
	cutoff := time.Now().UTC().Add(-rssMaxAge)
	var stories []Story
	for _, feed := range feeds {
		items, err := oneFeed(ctx, feed, cutoff)
		if err != nil {
			log.Printf("Failed to fetch feed %s: %v", feed.Name, err)
			continue
		}
		stories = append(stories, items...)
	}
	return stories, nil
}

func oneFeed(ctx context.Context, feed config.Feed, cutoff time.Time) ([]Story, error) {
	body, err := getBytes(ctx, feed.URL)
	if err != nil {
		return nil, err
	}
	items := parseFeed(body)
	var stories []Story
	for _, item := range items {
		if len(stories) >= itemsPerFeed {
			break
		}
		if item.title == "" || item.link == "" || item.published == nil || item.published.Before(cutoff) {
			continue
		}
		published := item.published.UTC()
		stories = append(stories, Story{
			SourceType:  "rss",
			SourceName:  clip(feed.Name, 64),
			Title:       clip(item.title, 512),
			URL:         clip(item.link, 1024),
			Author:      item.author,
			PublishedAt: &published,
			Excerpt:     clip(item.excerpt, rssExcerptChars),
		})
	}
	log.Printf("Fetched %d items from %s", len(stories), feed.Name)
	return stories, nil
}

func getJSON(ctx context.Context, rawURL string, query url.Values) (map[string]any, error) {
	address, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	address.RawQuery = query.Encode()
	body, err := getBytes(ctx, address.String())
	if err != nil {
		return nil, err
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func getBytes(ctx context.Context, rawURL string) ([]byte, error) {
	var last error
	for attempt := 1; attempt <= httpRetries+1; attempt++ {
		body, err := once(ctx, rawURL)
		if err == nil {
			return body, nil
		}
		last = err
		log.Printf("Request failed (%d/%d) GET %s: %v", attempt, httpRetries+1, rawURL, err)
		if attempt <= httpRetries {
			time.Sleep(500 * time.Millisecond)
		}
	}
	return nil, last
}

func once(ctx context.Context, rawURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "DailyCatch/1.0")
	response, err := (&http.Client{Timeout: httpTimeout}).Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode >= 400 {
		return nil, &statusError{status: response.StatusCode, url: rawURL}
	}
	return io.ReadAll(response.Body)
}

type statusError struct {
	status int
	url    string
}

func (e *statusError) Error() string {
	return "HTTP " + itoa(e.status) + " for " + e.url
}

func plain(value string) string {
	value = tags.ReplaceAllString(value, " ")
	value = html.UnescapeString(value)
	return strings.Join(strings.Fields(value), " ")
}

func objectList(value any) []map[string]any {
	items, _ := value.([]any)
	var out []map[string]any
	for _, item := range items {
		if object, ok := item.(map[string]any); ok {
			out = append(out, object)
		}
	}
	return out
}

func stringField(object map[string]any, key string) string {
	value, _ := object[key].(string)
	return value
}

func intField(object map[string]any, key string) *int {
	switch value := object[key].(type) {
	case float64:
		number := int(value)
		return &number
	case json.Number:
		parsed, err := value.Int64()
		if err != nil {
			return nil
		}
		number := int(parsed)
		return &number
	default:
		return nil
	}
}

func hnTime(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		log.Printf("Could not parse Hacker News time %s", value)
		return nil
	}
	utc := parsed.UTC()
	return &utc
}

func itoa(value int) string { return strconv.Itoa(value) }

type feedEntry struct {
	title     string
	link      string
	excerpt   string
	author    string
	published *time.Time
}

func parseFeed(raw []byte) []feedEntry {
	var rss struct {
		Channel struct {
			Items []struct {
				Title       string `xml:"title"`
				Link        string `xml:"link"`
				Description string `xml:"description"`
				Author      string `xml:"author"`
				PubDate     string `xml:"pubDate"`
				DCDate      string `xml:"http://purl.org/dc/elements/1.1/ date"`
			} `xml:"item"`
		} `xml:"channel"`
	}
	if err := xml.Unmarshal(raw, &rss); err == nil && len(rss.Channel.Items) > 0 {
		var entries []feedEntry
		for _, item := range rss.Channel.Items {
			published := parseFeedTime(item.PubDate)
			if published == nil {
				published = parseFeedTime(item.DCDate)
			}
			entries = append(entries, feedEntry{
				title:     plain(item.Title),
				link:      strings.TrimSpace(item.Link),
				excerpt:   plain(item.Description),
				author:    strings.TrimSpace(item.Author),
				published: published,
			})
		}
		return entries
	}
	var atom struct {
		Entries []struct {
			Title   string `xml:"title"`
			Updated string `xml:"updated"`
			Summary string `xml:"summary"`
			Author  struct {
				Name string `xml:"name"`
			} `xml:"author"`
			Link []struct {
				Href string `xml:"href,attr"`
				Rel  string `xml:"rel,attr"`
			} `xml:"link"`
		} `xml:"entry"`
	}
	if err := xml.Unmarshal(raw, &atom); err != nil {
		return nil
	}
	var entries []feedEntry
	for _, item := range atom.Entries {
		link := ""
		for _, candidate := range item.Link {
			if candidate.Rel == "" || candidate.Rel == "alternate" {
				link = candidate.Href
				break
			}
		}
		entries = append(entries, feedEntry{
			title:     plain(item.Title),
			link:      strings.TrimSpace(link),
			excerpt:   plain(item.Summary),
			author:    strings.TrimSpace(item.Author.Name),
			published: parseFeedTime(item.Updated),
		})
	}
	return entries
}

func parseFeedTime(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	for _, layout := range []string{time.RFC1123Z, time.RFC1123, time.RFC3339, time.RFC3339Nano} {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			utc := parsed.UTC()
			return &utc
		}
	}
	return nil
}
