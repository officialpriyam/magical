import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeStorageId, normalizeWorkspacePath } from './server.js'

test('normalizeStorageId rejects unsafe values', () => {
  assert.equal(normalizeStorageId(''), '')
  assert.equal(normalizeStorageId('../bad'), '')
  assert.equal(normalizeStorageId('abc123XYZ'), 'abc123XYZ')
})

test('normalizeWorkspacePath blocks traversal and sensitive locations', () => {
  assert.equal(normalizeWorkspacePath('../../../etc/passwd'), '')
  assert.equal(normalizeWorkspacePath('/home/user/.env'), '')
  assert.equal(normalizeWorkspacePath('/vercel/sandbox/src/app/page.tsx'), 'src/app/page.tsx')
  assert.equal(normalizeWorkspacePath('src/app/page.tsx'), 'src/app/page.tsx')
})
