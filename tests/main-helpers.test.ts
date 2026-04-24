import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProjectOutputDir,
  filterAllowedFields,
  hasFailedPages,
  isSafeExternalUrl,
  naturalSortFilenames,
  validateImageFilename
} from '../src/main/safety-utils.ts'

test('filterAllowedFields keeps only whitelisted keys', () => {
  assert.deepEqual(
    filterAllowedFields(
      {
        status: 'completed',
        final_prompt: 'keep',
        "__proto__": 'drop',
        'status = ? --': 'drop'
      },
      ['status', 'final_prompt']
    ),
    {
      status: 'completed',
      final_prompt: 'keep'
    }
  )
})

test('validateImageFilename rejects traversal and unsupported extensions', () => {
  assert.equal(validateImageFilename('001.png'), '001.png')
  assert.throws(() => validateImageFilename('../secret.txt'))
  assert.throws(() => validateImageFilename('nested/001.png'))
  assert.throws(() => validateImageFilename('001.txt'))
})

test('naturalSortFilenames sorts numeric page names correctly', () => {
  assert.deepEqual(
    naturalSortFilenames(['10.png', '2.png', '1.png', '11.png']),
    ['1.png', '2.png', '10.png', '11.png']
  )
})

test('buildProjectOutputDir joins the configured base and project name', () => {
  assert.equal(
    buildProjectOutputDir('output', 'Example Book'),
    'output/Example Book'
  )
})

test('hasFailedPages reports whether any page failed', () => {
  assert.equal(hasFailedPages([{ status: 'completed' }, { status: 'failed' }]), true)
  assert.equal(hasFailedPages([{ status: 'completed' }, { status: 'pending' }]), false)
})

test('isSafeExternalUrl only allows http and https URLs', () => {
  assert.equal(isSafeExternalUrl('https://example.com'), true)
  assert.equal(isSafeExternalUrl('http://example.com'), true)
  assert.equal(isSafeExternalUrl('file:///tmp/demo'), false)
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
})
