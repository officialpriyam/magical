import { DeepPartial } from 'ai'
import type { FragmentSchema } from '@/lib/schema'

export type GeneratedFile = {
  path: string
  content: string
  purpose?: string
}

export function getFragmentFiles(
  fragment?: DeepPartial<FragmentSchema> | null,
): GeneratedFile[] {
  if (!fragment) return []

  const files: GeneratedFile[] = Array.isArray(fragment.files)
    ? fragment.files
        .map((file) => ({
          path: cleanPath(file?.path),
          content: typeof file?.content === 'string' ? file.content : '',
          purpose: typeof file?.purpose === 'string' ? file.purpose : undefined,
        }))
        .filter((file) => file.path && file.content.length > 0)
    : []

  if (files.length === 0 && typeof fragment.file_path === 'string' && typeof fragment.code === 'string') {
    files.push({
      path: cleanPath(fragment.file_path),
      content: fragment.code,
    })
  }

  const byPath = new Map<string, GeneratedFile>()

  for (const file of files) {
    byPath.set(file.path, file)
  }

  return Array.from(byPath.values())
}

export function getFragmentFileCount(fragment?: DeepPartial<FragmentSchema> | null) {
  return getFragmentFiles(fragment).length
}

function cleanPath(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/\\/g, '/').replace(/^\/+/, '').trim()
    : ''
}
