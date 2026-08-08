package main

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

type CacheConfig struct {
	FilesTTL      time.Duration
	FileTTL       time.Duration
	ManifestTTL   time.Duration
}

type Cache struct {
	rdb    *redis.Client
	config CacheConfig
}

func NewCache(redisURL string, cfg CacheConfig) *Cache {
	if cfg.FilesTTL == 0 {
		cfg.FilesTTL = 30 * time.Second
	}
	if cfg.FileTTL == 0 {
		cfg.FileTTL = 60 * time.Second
	}
	if cfg.ManifestTTL == 0 {
		cfg.ManifestTTL = 5 * time.Minute
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		// If Redis URL is invalid or empty, use no-op cache
		return &Cache{rdb: nil, config: cfg}
	}

	rdb := redis.NewClient(opts)
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return &Cache{rdb: nil, config: cfg}
	}

	return &Cache{rdb: rdb, config: cfg}
}

func (c *Cache) Close() {
	if c.rdb != nil {
		c.rdb.Close()
	}
}

func (c *Cache) IsAvailable() bool {
	return c.rdb != nil
}

// workspaceFilesKey returns the cache key for the full file listing of a workspace.
func workspaceFilesKey(storageId string) string {
	return "ws:" + storageId + ":files"
}

// workspaceFileKey returns the cache key for a single file's content.
func workspaceFileKey(storageId, path string) string {
	return "ws:" + storageId + ":f:" + path
}

// workspaceManifestKey returns the cache key for a workspace manifest.
func workspaceManifestKey(storageId string) string {
	return "ws:" + storageId + ":manifest"
}

// GetFiles retrieves the cached file listing for a workspace.
func (c *Cache) GetFiles(ctx context.Context, storageId string) ([]WorkspaceFile, error) {
	if c.rdb == nil {
		return nil, redis.Nil
	}
	data, err := c.rdb.Get(ctx, workspaceFilesKey(storageId)).Bytes()
	if err != nil {
		return nil, err
	}
	var files []WorkspaceFile
	if err := json.Unmarshal(data, &files); err != nil {
		return nil, err
	}
	return files, nil
}

// SetFiles caches the file listing for a workspace.
func (c *Cache) SetFiles(ctx context.Context, storageId string, files []WorkspaceFile) error {
	if c.rdb == nil {
		return nil
	}
	data, err := json.Marshal(files)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, workspaceFilesKey(storageId), data, c.config.FilesTTL).Err()
}

// GetFile retrieves a single cached file.
func (c *Cache) GetFile(ctx context.Context, storageId, path string) (*WorkspaceFile, error) {
	if c.rdb == nil {
		return nil, redis.Nil
	}
	data, err := c.rdb.Get(ctx, workspaceFileKey(storageId, path)).Bytes()
	if err != nil {
		return nil, err
	}
	var file WorkspaceFile
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, err
	}
	return &file, nil
}

// SetFile caches a single file.
func (c *Cache) SetFile(ctx context.Context, storageId string, file WorkspaceFile) error {
	if c.rdb == nil {
		return nil
	}
	data, err := json.Marshal(file)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, workspaceFileKey(storageId, file.Path), data, c.config.FileTTL).Err()
}

// GetManifest retrieves a cached manifest.
func (c *Cache) GetManifest(ctx context.Context, storageId string) (*WorkspaceManifest, error) {
	if c.rdb == nil {
		return nil, redis.Nil
	}
	data, err := c.rdb.Get(ctx, workspaceManifestKey(storageId)).Bytes()
	if err != nil {
		return nil, err
	}
	var manifest WorkspaceManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	return &manifest, nil
}

// SetManifest caches a manifest.
func (c *Cache) SetManifest(ctx context.Context, storageId string, manifest WorkspaceManifest) error {
	if c.rdb == nil {
		return nil
	}
	data, err := json.Marshal(manifest)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, workspaceManifestKey(storageId), data, c.config.ManifestTTL).Err()
}

// InvalidateWorkspace removes all cache entries for a workspace.
func (c *Cache) InvalidateWorkspace(ctx context.Context, storageId string) {
	if c.rdb == nil {
		return
	}
	keys := []string{
		workspaceFilesKey(storageId),
		workspaceManifestKey(storageId),
	}
	c.rdb.Del(ctx, keys...)

	// Also scan and delete individual file keys
	iter := c.rdb.Scan(ctx, 0, "ws:"+storageId+":f:*", 100).Iterator()
	for iter.Next(ctx) {
		c.rdb.Del(ctx, iter.Val())
	}
}
