import test from 'node:test'
import assert from 'node:assert/strict'

import { sanitizeFolder, validateSeoInput } from '../api/seo-input.js'

test('validates and normalizes SEO workflow input', () => {
  const result = validateSeoInput({
    keyword: ' n8n 自動化 ',
    product: ' 顧問服務 ',
    scenario: ' 三人電商團隊 ',
    target_folder_key: '/review/正式 站//case-01/',
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.value, {
    keyword: 'n8n 自動化',
    product: '顧問服務',
    scenario: '三人電商團隊',
    target_folder_key: 'review/----/case-01',
  })
})

test('rejects missing required SEO input', () => {
  assert.deepEqual(validateSeoInput({ keyword: 'seo' }), { ok: false, error: '缺少欄位：product' })
})

test('provides a safe default folder', () => {
  assert.equal(sanitizeFolder(''), 'formal-site/seo-tool')
})
