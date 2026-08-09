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
  assert.deepEqual(validateSeoInput({ keyword: 'seo' }), { ok: false, error: '請填寫想賣的產品。' })
})

test('provides a safe default folder', () => {
  assert.equal(sanitizeFolder(''), 'formal-site/seo-tool')
})

test('rejects non-string and overlong values without coercing objects', () => {
  assert.equal(validateSeoInput({ keyword: {}, product: '服務', scenario: '情境' }).ok, false)
  assert.equal(validateSeoInput({ keyword: '字'.repeat(121), product: '服務', scenario: '情境' }).error, '關鍵字超過 120 字。')
  assert.equal(sanitizeFolder({ path: 'unsafe' }), 'formal-site/seo-tool')
})

test('removes invisible control characters from input', () => {
  const result = validateSeoInput({ keyword: 'SEO\u200b 工具', product: '顧問\n服務', scenario: '小型\t團隊' })
  assert.equal(result.ok, true)
  assert.equal(result.value.keyword, 'SEO 工具')
  assert.equal(result.value.product, '顧問 服務')
  assert.equal(result.value.scenario, '小型 團隊')
})
