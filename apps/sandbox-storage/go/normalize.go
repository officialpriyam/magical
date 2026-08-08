package main

import (
	"regexp"
	"strings"
)

var (
	skipPathRe = regexp.MustCompile(`(^|/)(\.git|node_modules|\.next|\.nuxt|dist|build|coverage|__pycache__|\.cache)(/|$)`)
	manifestName = ".sandbox-storage-manifest.json"
	storageIdRe = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)
)

// normalizeStorageId validates a storage ID format.
func normalizeStorageId(value string) string {
	if storageIdRe.MatchString(value) {
		return value
	}
	return ""
}

// normalizeWorkspacePath cleans and validates a workspace file path.
// Returns empty string for invalid/forbidden paths.
func normalizeWorkspacePath(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	cleaned := trimmed
	cleaned = strings.ReplaceAll(cleaned, "\\", "/")

	// Remove leading slashes and drive letters (Windows)
	for len(cleaned) > 0 && (cleaned[0] == '/' || (len(cleaned) >= 2 && cleaned[1] == ':')) {
		cleaned = cleaned[1:]
	}
	cleaned = strings.TrimPrefix(cleaned, "~/")
	cleaned = strings.TrimPrefix(cleaned, "home/user/")
	cleaned = strings.TrimPrefix(cleaned, "vercel/sandbox/")
	cleaned = strings.ReplaceAll(cleaned, "//", "/")

	if cleaned == "" || cleaned == "." || cleaned == ".." {
		return ""
	}

	parts := strings.Split(cleaned, "/")
	cleanParts := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" || part == "." || part == ".." || strings.Contains(part, "\x00") {
			return ""
		}
		cleanParts = append(cleanParts, part)
	}

	if len(cleanParts) == 0 {
		return ""
	}

	normalized := strings.Join(cleanParts, "/")

	if normalized == manifestName {
		return ""
	}
	if skipPathRe.MatchString(normalized) {
		return ""
	}

	return normalized
}
