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
  const path = row.path ?? row.file_path ?? ''
  const content =
    typeof row.content === 'string'
      ? row.content
      : typeof metadata.content === 'string'
        ? metadata.content
        : ''

  return {
    id: row.id,
    name: row.name ?? row.file_name ?? getWorkspaceFileParts(path).name,
    path,
    content,
    is_directory: typeof row.is_directory === 'boolean' ? row.is_directory : Boolean(metadata.is_directory),
    parent_path: row.parent_path ?? (typeof metadata.parent_path === 'string' ? metadata.parent_path : null),
    size_bytes:
      typeof row.size_bytes === 'number'
        ? row.size_bytes
        : typeof row.file_size === 'number'
          ? row.file_size
          : Buffer.byteLength(content, 'utf8'),
    updated_at: row.updated_at,
  }
}

export function toWorkspaceFileRow({
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
    path: parts.path,
    name: parts.name,
    content,
    is_directory: isDirectory,
    parent_path: parts.parentPath,
    size_bytes: Buffer.byteLength(content, 'utf8'),
    mime_type: isDirectory ? 'inode/directory' : 'text/plain',
    metadata: {
      source: 'workspace',
    },
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

export function isMissingWorkspaceTableError(error: any) {
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    /schema cache|could not find the table|relation .* does not exist/i.test(error?.message || '')
  )
}
