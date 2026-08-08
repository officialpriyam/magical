package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

type Handlers struct {
	config ServerConfig
	cache  *Cache
	auth   AuthConfig
}

type ServerConfig struct {
	RootDir      string
	MaxFiles     int
	MaxFileBytes int
	MaxBodyBytes int
}

func NewHandlers(cfg ServerConfig, cache *Cache, auth AuthConfig) *Handlers {
	return &Handlers{config: cfg, cache: cache, auth: auth}
}

func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, 200, map[string]interface{}{
		"ok":     true,
		"secure": true,
		"lang":   "go",
	})
}

func (h *Handlers) CreateWorkspace(w http.ResponseWriter, r *http.Request) {
	body, err := readBody(r, int64(h.config.MaxBodyBytes))
	if err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": err.Error()})
		return
	}

	var payload map[string]interface{}
	if len(body) > 0 {
		json.Unmarshal(body, &payload)
	} else {
		payload = map[string]interface{}{}
	}

	storageId := normalizeStorageId(toString(payload["storageId"]))
	if storageId == "" {
		storageId = randomUUID()
	}

	wp := workspacePaths(h.config.RootDir, storageId)
	ensureDir(wp.FilesDir)

	fileCount, _ := countFiles(r.Context(), wp.FilesDir, h.config.MaxFiles, int64(h.config.MaxFileBytes))

	manifest := WorkspaceManifest{
		StorageId:   storageId,
		OwnerUserId: toString(payload["userId"]),
		ProjectId:   toString(payload["projectId"]),
		FileCount:   fileCount,
	}
	writeManifest(wp.ManifestPath, manifest)

	if h.cache != nil {
		h.cache.SetManifest(r.Context(), storageId, manifest)
	}

	sendJSON(w, 200, map[string]interface{}{
		"storageId": storageId,
		"secure":    true,
	})
}

func (h *Handlers) ListFiles(w http.ResponseWriter, r *http.Request) {
	storageId := normalizeStorageId(chi.URLParam(r, "id"))
	if storageId == "" {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid storage ID"})
		return
	}

	if h.cache != nil {
		if files, err := h.cache.GetFiles(r.Context(), storageId); err == nil {
			manifest, _ := h.cache.GetManifest(r.Context(), storageId)
			sendJSON(w, 200, map[string]interface{}{
				"storageId": storageId,
				"files":     files,
				"manifest":  manifest,
				"secure":    true,
				"cached":    true,
			})
			return
		}
	}

	wp := workspacePaths(h.config.RootDir, storageId)
	ensureDir(wp.FilesDir)

	files, err := listWorkspaceFiles(r.Context(), wp.FilesDir, h.config.MaxFiles, int64(h.config.MaxFileBytes))
	if err != nil {
		sendJSON(w, 500, map[string]interface{}{
			"error":   "Failed to list files",
			"details": err.Error(),
		})
		return
	}

	manifest, _ := readManifest(wp.ManifestPath)

	if h.cache != nil {
		h.cache.SetFiles(r.Context(), storageId, files)
		if manifest != nil {
			h.cache.SetManifest(r.Context(), storageId, *manifest)
		}
	}

	sendJSON(w, 200, map[string]interface{}{
		"storageId": storageId,
		"files":     files,
		"manifest":  manifest,
		"secure":    true,
	})
}

func (h *Handlers) BatchReplace(w http.ResponseWriter, r *http.Request) {
	storageId := normalizeStorageId(chi.URLParam(r, "id"))
	if storageId == "" {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid storage ID"})
		return
	}

	body, err := readBody(r, int64(h.config.MaxBodyBytes))
	if err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": err.Error()})
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid JSON body"})
		return
	}

	rawFiles, ok := payload["files"].([]interface{})
	if !ok {
		sendJSON(w, 400, map[string]interface{}{"error": "Files array is required"})
		return
	}

	byPath := make(map[string]WorkspaceFile)
	for _, raw := range rawFiles {
		f, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		normalizedPath := normalizeWorkspacePath(toString(f["path"]))
		if normalizedPath == "" {
			continue
		}
		content := toString(f["content"])
		if int64(len(content)) > int64(h.config.MaxFileBytes) {
			continue
		}
		byPath[normalizedPath] = WorkspaceFile{Path: normalizedPath, Content: content}
		if len(byPath) > h.config.MaxFiles {
			break
		}
	}

	files := make([]WorkspaceFile, 0, len(byPath))
	for _, f := range byPath {
		files = append(files, f)
	}

	wp := workspacePaths(h.config.RootDir, storageId)
	os.RemoveAll(wp.FilesDir)
	ensureDir(wp.FilesDir)

	var writeMu sync.Mutex
	var writeErr error

	g, _ := errgroup.WithContext(r.Context())
	for _, file := range files {
		file := file
		g.Go(func() error {
			if err := writeWorkspaceFile(wp.FilesDir, file.Path, file.Content); err != nil {
				writeMu.Lock()
				if writeErr == nil {
					writeErr = err
				}
				writeMu.Unlock()
			}
			return nil
		})
	}
	g.Wait()

	if writeErr != nil {
		sendJSON(w, 500, map[string]interface{}{
			"error":   "Failed to write files",
			"details": writeErr.Error(),
		})
		return
	}

	fileCount, _ := countFiles(r.Context(), wp.FilesDir, h.config.MaxFiles, int64(h.config.MaxFileBytes))
	manifest := WorkspaceManifest{
		StorageId: storageId,
		FileCount: fileCount,
	}
	writeManifest(wp.ManifestPath, manifest)

	if h.cache != nil {
		h.cache.InvalidateWorkspace(r.Context(), storageId)
	}

	sendJSON(w, 200, map[string]interface{}{
		"storageId": storageId,
		"saved":     true,
		"fileCount": fileCount,
		"secure":    true,
	})
}

func (h *Handlers) WriteFile(w http.ResponseWriter, r *http.Request) {
	storageId := normalizeStorageId(chi.URLParam(r, "id"))
	if storageId == "" {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid storage ID"})
		return
	}

	body, err := readBody(r, int64(h.config.MaxBodyBytes))
	if err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": err.Error()})
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid JSON body"})
		return
	}

	filePath := normalizeWorkspacePath(toString(payload["path"]))
	if filePath == "" {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid file path"})
		return
	}

	content := toString(payload["content"])
	if int64(len(content)) > int64(h.config.MaxFileBytes) {
		sendJSON(w, 400, map[string]interface{}{"error": "File too large"})
		return
	}

	wp := workspacePaths(h.config.RootDir, storageId)
	ensureDir(wp.FilesDir)

	if err := writeWorkspaceFile(wp.FilesDir, filePath, content); err != nil {
		sendJSON(w, 500, map[string]interface{}{
			"error":   "Failed to write file",
			"details": err.Error(),
		})
		return
	}

	fileCount, _ := countFiles(r.Context(), wp.FilesDir, h.config.MaxFiles, int64(h.config.MaxFileBytes))
	manifest := WorkspaceManifest{
		StorageId: storageId,
		FileCount: fileCount,
	}
	writeManifest(wp.ManifestPath, manifest)

	if h.cache != nil {
		h.cache.InvalidateWorkspace(r.Context(), storageId)
	}

	sendJSON(w, 200, map[string]interface{}{
		"storageId": storageId,
		"saved":     true,
		"path":      filePath,
		"secure":    true,
	})
}

func (h *Handlers) DeleteFile(w http.ResponseWriter, r *http.Request) {
	storageId := normalizeStorageId(chi.URLParam(r, "id"))
	if storageId == "" {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid storage ID"})
		return
	}

	body, err := readBody(r, int64(h.config.MaxBodyBytes))
	if err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": err.Error()})
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid JSON body"})
		return
	}

	filePath := normalizeWorkspacePath(toString(payload["path"]))
	if filePath == "" {
		sendJSON(w, 400, map[string]interface{}{"error": "Path is required"})
		return
	}

	wp := workspacePaths(h.config.RootDir, storageId)

	if err := deleteWorkspaceFile(wp.FilesDir, filePath); err != nil {
		sendJSON(w, 500, map[string]interface{}{
			"error":   "Failed to delete file",
			"details": err.Error(),
		})
		return
	}

	fileCount, _ := countFiles(r.Context(), wp.FilesDir, h.config.MaxFiles, int64(h.config.MaxFileBytes))
	manifest := WorkspaceManifest{
		StorageId: storageId,
		FileCount: fileCount,
	}
	writeManifest(wp.ManifestPath, manifest)

	if h.cache != nil {
		h.cache.InvalidateWorkspace(r.Context(), storageId)
	}

	sendJSON(w, 200, map[string]interface{}{
		"storageId": storageId,
		"saved":     true,
		"secure":    true,
	})
}

func (h *Handlers) RenameFile(w http.ResponseWriter, r *http.Request) {
	storageId := normalizeStorageId(chi.URLParam(r, "id"))
	if storageId == "" {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid storage ID"})
		return
	}

	body, err := readBody(r, int64(h.config.MaxBodyBytes))
	if err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": err.Error()})
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		sendJSON(w, 400, map[string]interface{}{"error": "Invalid JSON body"})
		return
	}

	oldPath := normalizeWorkspacePath(toString(payload["oldPath"]))
	newPath := normalizeWorkspacePath(toString(payload["newPath"]))

	if oldPath == "" || newPath == "" {
		sendJSON(w, 400, map[string]interface{}{"error": "Old path and new path are required"})
		return
	}

	if strings.HasPrefix(newPath, oldPath+"/") {
		sendJSON(w, 400, map[string]interface{}{"error": "A folder cannot be renamed inside itself."})
		return
	}

	wp := workspacePaths(h.config.RootDir, storageId)

	if err := renameWorkspaceFile(wp.FilesDir, oldPath, newPath); err != nil {
		sendJSON(w, 500, map[string]interface{}{
			"error":   "Failed to rename file",
			"details": err.Error(),
		})
		return
	}

	if h.cache != nil {
		h.cache.InvalidateWorkspace(r.Context(), storageId)
	}

	sendJSON(w, 200, map[string]interface{}{
		"storageId": storageId,
		"saved":     true,
		"path":      newPath,
		"secure":    true,
	})
}

func readBody(r *http.Request, maxBytes int64) ([]byte, error) {
	r.Body = http.MaxBytesReader(nil, r.Body, maxBytes)
	return io.ReadAll(r.Body)
}

func sendJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	s, ok := v.(string)
	if ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func ensureDir(dir string) {
	os.MkdirAll(dir, 0755)
}

func randomUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
