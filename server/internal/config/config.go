package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const DefaultRSS = "BBC World|http://feeds.bbci.co.uk/news/world/rss.xml,The Guardian Tech|https://www.theguardian.com/uk/technology/rss"

type Feed struct {
	Name string
	URL  string
}

type Settings struct {
	DeepSeekKey string
	DBHost      string
	DBPort      int
	DBUser      string
	DBPassword  string
	DBName      string
	Feeds       []Feed
	SchemaPath  string
}

func Load() (Settings, error) {
	envPath, err := find("dailycatch", ".env")
	if err != nil {
		return Settings{}, err
	}
	values, err := readEnv(envPath)
	if err != nil {
		return Settings{}, err
	}
	for _, key := range []string{"DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"} {
		if strings.TrimSpace(values[key]) == "" {
			return Settings{}, fmt.Errorf("missing environment variable %s", key)
		}
	}
	port := 3306
	if raw := strings.TrimSpace(values["DB_PORT"]); raw != "" {
		port, err = strconv.Atoi(raw)
		if err != nil {
			return Settings{}, fmt.Errorf("DB_PORT: %w", err)
		}
	}
	feeds, err := parseFeeds(valueOr(values, "RSS_FEEDS", DefaultRSS))
	if err != nil {
		return Settings{}, err
	}
	schema, err := find("schema.sql")
	if err != nil {
		return Settings{}, err
	}
	return Settings{
		DeepSeekKey: strings.TrimSpace(values["DEEPSEEK_API_KEY"]),
		DBHost:      strings.TrimSpace(values["DB_HOST"]),
		DBPort:      port,
		DBUser:      strings.TrimSpace(values["DB_USER"]),
		DBPassword:  values["DB_PASSWORD"],
		DBName:      strings.TrimSpace(values["DB_NAME"]),
		Feeds:       feeds,
		SchemaPath:  schema,
	}, nil
}

func parseFeeds(raw string) ([]Feed, error) {
	var feeds []Feed
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		name, url, ok := strings.Cut(part, "|")
		name, url = strings.TrimSpace(name), strings.TrimSpace(url)
		if !ok || name == "" || url == "" {
			return nil, fmt.Errorf("invalid RSS feed entry: %s", part)
		}
		feeds = append(feeds, Feed{Name: name, URL: url})
	}
	if len(feeds) == 0 {
		return nil, fmt.Errorf("RSS_FEEDS is empty")
	}
	return feeds, nil
}

func readEnv(path string) (map[string]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	values := map[string]string{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		values[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), `"'`)
	}
	return values, scanner.Err()
}

func find(parts ...string) (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for range 6 {
		candidate := filepath.Join(append([]string{dir}, parts...)...)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("%s not found", filepath.Join(parts...))
}

func valueOr(values map[string]string, key, fallback string) string {
	if value := strings.TrimSpace(values[key]); value != "" {
		return value
	}
	return fallback
}
