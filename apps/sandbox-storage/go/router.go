package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// Rate limiter per IP
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	limit    int
	window   time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Clean old entries
	reqs := rl.requests[ip]
	valid := make([]time.Time, 0, len(reqs))
	for _, t := range reqs {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		rl.requests[ip] = valid
		return false
	}

	rl.requests[ip] = append(valid, now)
	return true
}

func NewRouter(handlers *Handlers, auth AuthConfig) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Rate limiter: 100 requests per minute per IP
	rateLimiter := NewRateLimiter(100, time.Minute)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
				ip = strings.Split(fwd, ",")[0]
			}
			if !rateLimiter.Allow(strings.TrimSpace(ip)) {
				sendJSON(w, 429, map[string]interface{}{
					"error": "Rate limit exceeded. Try again in a minute.",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// Request ID middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		 requestId := r.Header.Get("X-Request-Id")
			if requestId == "" {
				b := make([]byte, 8)
				rand.Read(b)
				requestId = hex.EncodeToString(b)
			}
			w.Header().Set("X-Request-Id", requestId)
			ctx := context.WithValue(r.Context(), "requestId", requestId)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})

	// Security headers
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "no-referrer")
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
			w.Header().Set("Pragma", "no-cache")

			// CORS: only allow same-origin or configured origins
			origin := r.Header.Get("Origin")
			if origin != "" {
				// In production, restrict to your domain
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Sandbox-Storage-Key, X-Sandbox-Storage-Signature, X-Sandbox-Storage-Timestamp, X-Request-Id")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}

			// Handle preflight
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	})

	// Auth middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip auth for health check
			if r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			// Skip auth if no credentials configured
			if auth.IsOpen() {
				next.ServeHTTP(w, r)
				return
			}

			// Read body for auth signature verification
			body, err := io.ReadAll(io.LimitReader(r.Body, int64(handlers.config.MaxBodyBytes)))
			if err != nil {
				sendJSON(w, 400, map[string]interface{}{"error": "Request body too large"})
				return
			}

			if !auth.isAuthorized(r, body) {
				sendJSON(w, 401, map[string]interface{}{"error": "Unauthorized"})
				return
			}

			// Restore body for handler to read
			r.Body = io.NopCloser(strings.NewReader(string(body)))

			next.ServeHTTP(w, r)
		})
	})

	// Routes
	r.Get("/health", handlers.Health)
	r.Post("/v1/workspaces", handlers.CreateWorkspace)

	r.Route("/v1/workspaces/{id}/files", func(r chi.Router) {
		r.Get("/", handlers.ListFiles)
		r.Put("/batch", handlers.BatchReplace)
		r.Put("/", handlers.WriteFile)
		r.Delete("/", handlers.DeleteFile)
		r.Patch("/", handlers.RenameFile)
	})

	return r
}

func StartServer(addr string, router *chi.Mux) {
	log.Printf("sandbox-storage (Go) listening on %s", addr)
	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	log.Fatal(srv.ListenAndServe())
}
