# Sandbox Storage

Ultra-fast file storage service for Magical sandbox workspaces. Written in Go with Redis caching.

## Quick Start

### Build
```bash
cd apps/sandbox-storage/go
go build -o ../sandbox-storage .
```

### Run
```bash
cd apps/sandbox-storage
SANDBOX_STORAGE_TOKEN=change-me PORT=8787 ./sandbox-storage
```

### With Redis (recommended)
```bash
REDIS_URL=redis://localhost:6379 SANDBOX_STORAGE_TOKEN=change-me PORT=8787 ./sandbox-storage
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Server port |
| `SANDBOX_STORAGE_ROOT` | `./data` | Root directory for workspace files |
| `SANDBOX_STORAGE_TOKEN` | (empty) | Bearer token for auth |
| `SANDBOX_STORAGE_ACCESS_KEY` | (empty) | HMAC access key |
| `SANDBOX_STORAGE_ACCESS_SALT` | (empty) | HMAC access salt |
| `REDIS_URL` | (empty) | Redis URL for caching |
| `SANDBOX_STORAGE_MAX_FILES` | `1000` | Max files per workspace |
| `SANDBOX_STORAGE_MAX_FILE_BYTES` | `1048576` | Max file size (1MB) |
| `SANDBOX_STORAGE_MAX_BODY_BYTES` | `10485760` | Max request body (10MB) |

## API

- `GET /health` - Health check
- `POST /v1/workspaces` - Create workspace
- `GET /v1/workspaces/:id/files` - List all files
- `PUT /v1/workspaces/:id/files/batch` - Replace all files
- `PUT /v1/workspaces/:id/files` - Write single file
- `DELETE /v1/workspaces/:id/files` - Delete file
- `PATCH /v1/workspaces/:id/files` - Rename file

## Authentication

### Bearer Token
```
Authorization: Bearer <token>
```

### HMAC Signature
```
x-sandbox-storage-key: <access-key>
x-sandbox-storage-signature: <hmac-sha256>
x-sandbox-storage-timestamp: <unix-ms>
```

## Deploy

### Docker
```bash
docker build -t sandbox-storage .
docker run -p 8787:8787 -e SANDBOX_STORAGE_TOKEN=change-me sandbox-storage
```

### Binary
```bash
# Build for Linux (from any OS)
cd go
GOOS=linux GOARCH=amd64 go build -o sandbox-storage .

# Copy to server and run
scp sandbox-storage user@server:/opt/sandbox-storage/
ssh user@server "cd /opt/sandbox-storage && ./sandbox-storage"
```

## Performance

- **Concurrent file reads** via goroutines
- **Redis caching** (30s file list, 60s file content, 5min manifest)
- **Atomic writes** (temp + rename)
- **Rate limiting** (100 req/min per IP)
- **Compiled binary** - no runtime overhead
