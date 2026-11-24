package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"dailycatch/server/internal/store"
)

func New(db *sql.DB) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/dates", func(w http.ResponseWriter, r *http.Request) {
		issues, err := store.ListDates(r.Context(), db)
		if err != nil {
			log.Printf("dates: %v", err)
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, issues)
	})
	mux.HandleFunc("GET /api/digests/{date}", func(w http.ResponseWriter, r *http.Request) {
		// The path is YYYYMMDD. The JSON date field stays YYYY-MM-DD.
		day, err := time.Parse("20060102", r.PathValue("date"))
		if err != nil {
			http.Error(w, "Invalid date", http.StatusBadRequest)
			return
		}
		digest, found, err := store.LoadDigest(r.Context(), db, day)
		if err != nil {
			log.Printf("digest: %v", err)
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		if !found {
			http.Error(w, "No digest for this date", http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, digest)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.URL.Path) >= 4 && r.URL.Path[:4] == "/api" {
			w.Header().Set("Cache-Control", "no-store")
		}
		mux.ServeHTTP(w, r)
	})
}

func Ping(ctx context.Context, db *sql.DB) error {
	return db.PingContext(ctx)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		log.Printf("write json: %v", err)
	}
}
