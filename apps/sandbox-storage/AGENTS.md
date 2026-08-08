# Sandbox Storage Service

## What is this?

A standalone, ultra-fast file storage service for Magical sandbox workspaces. Written in Go with Redis caching. Runs independently from the main Next.js app on a separate machine.

## Why does it exist?

The main Magical app needs persistent file storage for sandbox projects. Each project gets a storage workspace. When a sandbox starts, files are loaded from this service. When files are edited, they are saved here. This keeps file storage decoupled from the sandbox runtime.

## Architecture

```
Main App (Next.js)  ──HTTP──>  Sandbox Storage (Go)  ──Disk──>  Workspace Files
                                      │
                                      └──Redis──>  Cache Layer
```

## Directory Structure

```
apps/sandbox-storage/
├── go/                    # Go source code
│   ├── main.go           # Entry point, config loading
│   ├── router.go         # chi router, middleware, auth
│   ├── handlers.go       # HTTP handlers
│   ├── auth.go           # Token + HMAC signature auth
│   ├── files.go          # Concurrent file I/O
│   ├── cache.go          # Redis caching layer
│   └── normalize.go      # Path normalization
├── Dockerfile            # Multi-stage Docker build
├── .env.example          # Configuration template
├── package.json          # Build scripts
└── README.md             # Documentation
```

## How it works

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (no auth required) |
| `POST` | `/v1/workspaces` | Create/verify a workspace |
| `GET` | `/v1/workspaces/:id/files` | List all files (with contents) |
| `PUT` | `/v1/workspaces/:id/files/batch` | Replace all files |
| `PUT` | `/v1/workspaces/:id/files` | Write single file |
| `DELETE` | `/v1/workspaces/:id/files` | Delete file/folder |
| `PATCH` | `/v1/workspaces/:id/files` | Rename file/folder |

### Data Flow

1. **Project Created** → `POST /v1/workspaces` creates workspace directory
2. **Files Generated** → `PUT /v1/workspaces/:id/files/batch` writes all generated files
3. **Sandbox Starts** → `GET /v1/workspaces/:id/files` loads files into sandbox
4. **File Edited** → `PUT /v1/workspaces/:id/files` saves single file
5. **File Opened** → `GET /v1/workspaces/:id/files` with path param reads single file

### Authentication

Two methods supported:

1. **Bearer Token**: `Authorization: Bearer <SANDBOX_STORAGE_TOKEN>`
2. **HMAC Signature**: Requires `SANDBOX_STORAGE_ACCESS_KEY` + `SANDBOX_STORAGE_ACCESS_SALT`

The HMAC method signs requests with: `HMAC-SHA256(accessKey:accessSalt, timestamp:method:path:bodyHash)`

### Caching (Redis)

- **File listings**: Cached 30 seconds
- **Individual files**: Cached 60 seconds  
- **Manifests**: Cached 5 minutes
- Cache invalidated on any write/delete/rename

## Configuration

All via environment variables:

```bash
PORT=8787                                    # Server port
SANDBOX_STORAGE_ROOT=./data                  # File storage root
SANDBOX_STORAGE_TOKEN=change-me              # Auth token
SANDBOX_STORAGE_ACCESS_KEY=your-key          # HMAC key
SANDBOX_STORAGE_ACCESS_SALT=your-salt        # HMAC salt
REDIS_URL=redis://localhost:6379             # Redis cache
SANDBOX_STORAGE_MAX_FILES=1000               # Max files/workspace
SANDBOX_STORAGE_MAX_FILE_BYTES=1048576       # Max file size (1MB)
SANDBOX_STORAGE_MAX_BODY_BYTES=10485760      # Max request body (10MB)
```

## Deployment

### Build
```bash
cd apps/sandbox-storage/go
go build -o ../sandbox-storage .
```

### Run
```bash
SANDBOX_STORAGE_TOKEN=change-me PORT=8787 ./sandbox-storage
```

### Docker
```bash
docker build -t sandbox-storage .
docker run -p 8787:8787 -e SANDBOX_STORAGE_TOKEN=change-me sandbox-storage
```

## Main App Integration

The main Next.js app connects to this service via:

```bash
SANDBOX_STORAGE_URL=http://your-server:8787
SANDBOX_STORAGE_TOKEN=change-me
```

The client code is in `lib/sandbox-storage.ts`. It:
- Signs requests with HMAC
- Caches file lists in KV (30s TTL)
- Falls back to live sandbox on 404

## Security

- Rate limiting: 100 requests/minute per IP
- Body size limits enforced
- Path traversal protection
- Auth required for all endpoints except `/health`
- Non-root Docker user
- Security headers (X-Frame-Options, CSP, etc.)

## Troubleshooting

### "Unauthorized" errors
- Check `SANDBOX_STORAGE_TOKEN` matches between client and server
- Verify HMAC signature headers are present
- Check timestamp is within 5 minutes

### Files missing
- Check `SANDBOX_STORAGE_ROOT` points to correct directory
- Verify workspace exists: `ls $SANDBOX_STORAGE_ROOT/<storage-id>/files/`
- Check Redis cache: `redis-cli GET ws:<storage-id>:files`

### Slow responses
- Enable Redis: `REDIS_URL=redis://localhost:6379`
- Check disk I/O on storage server
- Monitor with: `curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8787/health`
