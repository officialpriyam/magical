package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
)

func main() {
	// Load configuration from environment
	rootDir := os.Getenv("SANDBOX_STORAGE_ROOT")
	if rootDir == "" {
		// Default to data/ directory relative to the binary
		execPath, _ := os.Executable()
		rootDir = filepath.Join(filepath.Dir(execPath), "data")
	}

	port := getEnvInt("PORT", 8787)
	maxFiles := getEnvInt("SANDBOX_STORAGE_MAX_FILES", 1000)
	maxFileBytes := getEnvInt("SANDBOX_STORAGE_MAX_FILE_BYTES", 1024*1024)
	maxBodyBytes := getEnvInt("SANDBOX_STORAGE_MAX_BODY_BYTES", 10*1024*1024)
	redisURL := os.Getenv("REDIS_URL")

	accessToken := os.Getenv("SANDBOX_STORAGE_TOKEN")
	accessKey := os.Getenv("SANDBOX_STORAGE_ACCESS_KEY")
	accessSalt := os.Getenv("SANDBOX_STORAGE_ACCESS_SALT")

	// Ensure root directory exists
	os.MkdirAll(rootDir, 0755)

	// Initialize auth
	auth := NewAuthConfig(accessToken, accessKey, accessSalt)

	// Initialize Redis cache
	cache := NewCache(redisURL, CacheConfig{})
	if cache.IsAvailable() {
		fmt.Println("Redis cache: enabled")
	} else {
		fmt.Println("Redis cache: disabled (using no-op)")
	}

	// Initialize handlers
	config := ServerConfig{
		RootDir:      rootDir,
		MaxFiles:     maxFiles,
		MaxFileBytes: maxFileBytes,
		MaxBodyBytes: maxBodyBytes,
	}
	handlers := NewHandlers(config, cache, auth)

	// Create router
	router := NewRouter(handlers, auth)

	// Start server
	addr := fmt.Sprintf(":%d", port)
	fmt.Printf("sandbox-storage (Go) starting on %s\n", addr)
	fmt.Printf("data root: %s\n", rootDir)
	if auth.IsOpen() {
		fmt.Println("protection: auth disabled")
	} else {
		fmt.Println("protection: signature-based auth enabled")
	}

	StartServer(addr, router)
}

func getEnvInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	intVal, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return intVal
}
