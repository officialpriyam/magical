# Sandbox Storage

Standalone file storage service for Magical sandbox workspaces.

Run it on any machine with Node 20+:

```bash
cd apps/sandbox-storage
SANDBOX_STORAGE_TOKEN=change-me SANDBOX_STORAGE_ROOT=./data PORT=8787 pnpm start
```

Configure the main Magical app:

```bash
SANDBOX_STORAGE_URL=http://your-storage-machine:8787
SANDBOX_STORAGE_TOKEN=change-me
```

The main app creates one storage ID per project and stores that ID in project metadata. New E2B or Vercel sandboxes hydrate from this service, and file edits are written to storage before or alongside the live sandbox.

## API

- `POST /v1/workspaces` creates or verifies a workspace.
- `GET /v1/workspaces/:id/files` returns all stored files.
- `PUT /v1/workspaces/:id/files/batch` replaces the workspace snapshot.
- `PUT /v1/workspaces/:id/files` writes one file.
- `DELETE /v1/workspaces/:id/files` deletes one file or folder.
- `PATCH /v1/workspaces/:id/files` renames one file or folder.

Set `SANDBOX_STORAGE_TOKEN` on the service to require `Authorization: Bearer <token>`.
