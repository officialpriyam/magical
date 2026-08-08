package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
)

type WorkspaceFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type WorkspaceManifest struct {
	Version     int    `json:"version,omitempty"`
	Provider    string `json:"provider,omitempty"`
	StorageId   string `json:"storageId,omitempty"`
	OwnerUserId string `json:"ownerUserId,omitempty"`
	ProjectId   string `json:"projectId,omitempty"`
	FileCount   int    `json:"fileCount,omitempty"`
	CreatedAt   string `json:"createdAt,omitempty"`
	UpdatedAt   string `json:"updatedAt,omitempty"`
}

type WorkspacePaths struct {
	Dir          string
	FilesDir     string
	ManifestPath string
}

func workspacePaths(rootDir, storageId string) WorkspacePaths {
	dir := filepath.Join(rootDir, storageId)
	return WorkspacePaths{
		Dir:          dir,
		FilesDir:     filepath.Join(dir, "files"),
		ManifestPath: filepath.Join(dir, manifestName),
	}
}

// listWorkspaceFiles reads all files from a workspace directory concurrently.
func listWorkspaceFiles(ctx context.Context, filesDir string, maxFiles int, maxFileBytes int64) ([]WorkspaceFile, error) {
	if _, err := os.Stat(filesDir); os.IsNotExist(err) {
		return []WorkspaceFile{}, nil
	}

	type fileEntry struct {
		path    string
		content string
		order   int
	}

	var mu sync.Mutex
	var entries []fileEntry

	g, _ := errgroup.WithContext(ctx)

	// Walk the directory tree and collect file paths first
	var filePaths []string
	err := filepath.Walk(filesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		relPath, _ := filepath.Rel(filesDir, path)
		relPath = filepath.ToSlash(relPath)

		if skipPathRe.MatchString(relPath) || strings.HasPrefix(info.Name(), ".") {
			return nil
		}
		if info.Size() > int64(maxFileBytes) {
			return nil
		}

		filePaths = append(filePaths, relPath)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk directory: %w", err)
	}

	sort.Strings(filePaths)

	if len(filePaths) > maxFiles {
		filePaths = filePaths[:maxFiles]
	}

	// Read files concurrently
	for i, relPath := range filePaths {
		relPath := relPath
		i := i
		g.Go(func() error {
			fullPath := filepath.Join(filesDir, filepath.FromSlash(relPath))
			data, err := os.ReadFile(fullPath)
			if err != nil {
				return nil
			}
			mu.Lock()
			entries = append(entries, fileEntry{
				path:    relPath,
				content: string(data),
				order:   i,
			})
			mu.Unlock()
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].order < entries[j].order
	})

	files := make([]WorkspaceFile, len(entries))
	for i, e := range entries {
		files[i] = WorkspaceFile{Path: e.path, Content: e.content}
	}

	return files, nil
}

func countFiles(ctx context.Context, filesDir string, maxFiles int, maxFileBytes int64) (int, error) {
	files, err := listWorkspaceFiles(ctx, filesDir, maxFiles, maxFileBytes)
	return len(files), err
}

func writeWorkspaceFile(filesDir, filePath, content string) error {
	target := filepath.Join(filesDir, filepath.FromSlash(filePath))

	absTarget, _ := filepath.Abs(target)
	absRoot, _ := filepath.Abs(filesDir)
	if absTarget != absRoot && !strings.HasPrefix(absTarget, absRoot+string(os.PathSeparator)) {
		return fmt.Errorf("access denied: path traversal attempt")
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	tmpFile := filepath.Join(filepath.Dir(target), fmt.Sprintf(".%s.%d.tmp", filepath.Base(target), os.Getpid()))
	if err := os.WriteFile(tmpFile, []byte(content), 0644); err != nil {
		return fmt.Errorf("write tmp: %w", err)
	}
	if err := os.Rename(tmpFile, target); err != nil {
		os.Remove(tmpFile)
		return fmt.Errorf("rename: %w", err)
	}

	return nil
}

func deleteWorkspaceFile(filesDir, filePath string) error {
	target := filepath.Join(filesDir, filepath.FromSlash(filePath))
	absTarget, _ := filepath.Abs(target)
	absRoot, _ := filepath.Abs(filesDir)
	if absTarget != absRoot && !strings.HasPrefix(absTarget, absRoot+string(os.PathSeparator)) {
		return fmt.Errorf("access denied: path traversal attempt")
	}
	return os.RemoveAll(target)
}

func renameWorkspaceFile(filesDir, oldPath, newPath string) error {
	source := filepath.Join(filesDir, filepath.FromSlash(oldPath))
	target := filepath.Join(filesDir, filepath.FromSlash(newPath))

	absSource, _ := filepath.Abs(source)
	absTarget, _ := filepath.Abs(target)
	absRoot, _ := filepath.Abs(filesDir)

	if absSource != absRoot && !strings.HasPrefix(absSource, absRoot+string(os.PathSeparator)) {
		return fmt.Errorf("access denied: source path traversal")
	}
	if absTarget != absRoot && !strings.HasPrefix(absTarget, absRoot+string(os.PathSeparator)) {
		return fmt.Errorf("access denied: target path traversal")
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	return os.Rename(source, target)
}

func readManifest(manifestPath string) (*WorkspaceManifest, error) {
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, err
	}
	var manifest WorkspaceManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	return &manifest, nil
}

func writeManifest(manifestPath string, updates WorkspaceManifest) error {
	existing, _ := readManifest(manifestPath)

	now := time.Now().UTC().Format(time.RFC3339)
	result := WorkspaceManifest{
		Version:     1,
		Provider:    "sandbox-storage",
		StorageId:   updates.StorageId,
		OwnerUserId: updates.OwnerUserId,
		ProjectId:   updates.ProjectId,
		FileCount:   updates.FileCount,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if existing != nil {
		if result.StorageId == "" {
			result.StorageId = existing.StorageId
		}
		if result.OwnerUserId == "" {
			result.OwnerUserId = existing.OwnerUserId
		}
		if result.ProjectId == "" {
			result.ProjectId = existing.ProjectId
		}
		if result.FileCount == 0 {
			result.FileCount = existing.FileCount
		}
		if existing.CreatedAt != "" {
			result.CreatedAt = existing.CreatedAt
		}
	}

	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(manifestPath), 0755); err != nil {
		return err
	}

	return os.WriteFile(manifestPath, data, 0644)
}
