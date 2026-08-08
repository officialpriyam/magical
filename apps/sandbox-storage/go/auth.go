package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type AuthConfig struct {
	AccessToken string
	AccessKey   string
	AccessSalt  string
}

func NewAuthConfig(token, key, salt string) AuthConfig {
	return AuthConfig{
		AccessToken: strings.TrimSpace(token),
		AccessKey:   strings.TrimSpace(key),
		AccessSalt:  strings.TrimSpace(salt),
	}
}

func (a AuthConfig) IsOpen() bool {
	return a.AccessToken == "" && a.AccessKey == "" && a.AccessSalt == ""
}

// isAuthorized checks if the request is authorized via token or HMAC signature.
func (a AuthConfig) isAuthorized(r *http.Request, bodyRaw []byte) bool {
	if a.IsOpen() {
		return true
	}

	// Check Bearer token
	if a.AccessToken != "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			if timingSafeEqual([]byte(token), []byte(a.AccessToken)) {
				return true
			}
		}
	}

	// Check HMAC signature
	if a.AccessKey != "" && a.AccessSalt != "" {
		key := r.Header.Get("x-sandbox-storage-key")
		signature := r.Header.Get("x-sandbox-storage-signature")
		timestamp := r.Header.Get("x-sandbox-storage-timestamp")
		requestId := r.Header.Get("x-request-id")

		if key == "" || signature == "" || timestamp == "" {
			return false
		}

		if !timingSafeEqual([]byte(key), []byte(a.AccessKey)) {
			return false
		}

		ts, err := strconv.ParseInt(timestamp, 10, 64)
		if err != nil {
			return false
		}
		now := time.Now().UnixMilli()
		if math.Abs(float64(now-ts)) > 5*60*1000 {
			return false
		}

		bodyHash := sha256Sum(bodyRaw)
		payload := timestamp + ":" + r.Method + ":" + r.URL.Path + ":" + bodyHash
		expected := a.createSignature(payload)

		if !timingSafeEqual([]byte(signature), []byte(expected)) {
			return false
		}

		if requestId != "" && len(requestId) > 128 {
			return false
		}

		return true
	}

	return false
}

func (a AuthConfig) createSignature(payload string) string {
	mac := hmac.New(sha256.New, []byte(a.AccessKey+":"+a.AccessSalt))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func sha256Sum(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

func timingSafeEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	return hmac.Equal(a, b)
}
