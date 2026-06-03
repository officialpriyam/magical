export type WorkspaceFile = {
  id?: string
  name: string
  path: string
  content: string
  is_directory: boolean
  parent_path: string | null
  size_bytes: number
  updated_at?: string
}

export function normalizeWorkspacePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').trim()
}

export function getWorkspaceFileParts(path: string) {
  const normalizedPath = normalizeWorkspacePath(path)
  const pathParts = normalizedPath.split('/').filter(Boolean)
  const name = pathParts[pathParts.length - 1]
  const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null

  return {
    path: normalizedPath,
    name,
    parentPath,
  }
}

export function toWorkspaceFile(row: any): WorkspaceFile {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}

  return {
    id: row.id,
    name: row.file_name,
    path: row.file_path,
    content: typeof metadata.content === 'string' ? metadata.content : '',
    is_directory: Boolean(metadata.is_directory),
    parent_path: typeof metadata.parent_path === 'string' ? metadata.parent_path : null,
    size_bytes: typeof row.file_size === 'number' ? row.file_size : 0,
    updated_at: row.updated_at,
  }
}

export function toFileUploadRow({
  userId,
  path,
  content = '',
  isDirectory = false,
}: {
  userId: string
  path: string
  content?: string
  isDirectory?: boolean
}) {
  const parts = getWorkspaceFileParts(path)

  return {
    user_id: userId,
    file_name: parts.name,
    file_path: parts.path,
    file_size: Buffer.byteLength(content, 'utf8'),
    mime_type: isDirectory ? 'inode/directory' : 'text/plain',
    bucket_name: 'workspace-files',
    is_public: false,
    metadata: {
      content,
      is_directory: isDirectory,
      parent_path: parts.parentPath,
    },
  }
}
