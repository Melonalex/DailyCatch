package main

import (
	"context"
	"database/sql"
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"dailycatch/server/internal/config"
	"dailycatch/server/internal/fetch"
	"dailycatch/server/internal/httpapi"
	"dailycatch/server/internal/store"
)

func main() {
	log.SetFlags(log.LstdFlags)
	if len(os.Args) > 1 && os.Args[1] == "fetch" {
		os.Exit(runFetch(os.Args[2:]))
	}
	settings, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	db, err := store.Open(settings)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if err := store.EnsureSchema(ctx, db, settings.SchemaPath); err != nil {
		log.Fatal(err)
	}
	go schedule(db, settings)
	server := &http.Server{
		Addr:              "127.0.0.1:8000",
		Handler:           httpapi.New(db),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("DailyCatch API listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

func runFetch(args []string) int {
	flags := flag.NewFlagSet("fetch", flag.ContinueOnError)
	dateFlag := flags.String("date", "", "Digest date YYYY-MM-DD (default: today in Asia/Shanghai)")
	noAI := flags.Bool("no-ai", false, "Skip DeepSeek")
	if err := flags.Parse(args); err != nil {
		return 1
	}
	settings, db, code := openDB()
	if code != 0 {
		return code
	}
	defer db.Close()
	day := shanghaiNow()
	if *dateFlag != "" {
		parsed, err := time.Parse("2006-01-02", *dateFlag)
		if err != nil {
			log.Printf("Invalid --date value %s", *dateFlag)
			return 1
		}
		day = parsed
	}
	if err := fetch.Run(context.Background(), db, settings, day, !*noAI); err != nil {
		log.Print(err)
		return 1
	}
	return 0
}

func schedule(db *sql.DB, settings config.Settings) {
	if pastRunTime() {
		exists, err := store.LessonExists(context.Background(), db, shanghaiNow())
		if err != nil {
			log.Printf("Could not check today's lesson: %v", err)
		} else if !exists {
			runOnce(db, settings)
		}
	}
	for {
		delay := untilNextRun()
		log.Printf("Next digest fetch in %.0f seconds", delay.Seconds())
		time.Sleep(delay)
		runOnce(db, settings)
	}
}

func runOnce(db *sql.DB, settings config.Settings) {
	log.Printf("Starting scheduled digest fetch")
	err := fetch.Run(context.Background(), db, settings, shanghaiNow(), true)
	if err != nil {
		log.Printf("Scheduled fetch finished with error: %v", err)
		return
	}
	log.Printf("Scheduled digest fetch finished")
}

func openDB() (config.Settings, *sql.DB, int) {
	settings, err := config.Load()
	if err != nil {
		log.Print(err)
		return settings, nil, 1
	}
	db, err := store.Open(settings)
	if err != nil {
		log.Print(err)
		return settings, nil, 1
	}
	if err := store.EnsureSchema(context.Background(), db, settings.SchemaPath); err != nil {
		log.Print(err)
		db.Close()
		return settings, nil, 1
	}
	return settings, db, 0
}

func shanghaiNow() time.Time {
	zone, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		zone = time.FixedZone("CST", 8*60*60)
	}
	now := time.Now().In(zone)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

func pastRunTime() bool {
	zone, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		zone = time.FixedZone("CST", 8*60*60)
	}
	now := time.Now().In(zone)
	return now.Hour() > 7 || (now.Hour() == 7 && now.Minute() >= 0)
}

func untilNextRun() time.Duration {
	zone, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		zone = time.FixedZone("CST", 8*60*60)
	}
	now := time.Now().In(zone)
	target := time.Date(now.Year(), now.Month(), now.Day(), 7, 0, 0, 0, zone)
	if !now.Before(target) {
		target = target.Add(24 * time.Hour)
	}
	delay := target.Sub(now)
	if delay < time.Second {
		return time.Second
	}
	return delay
}
