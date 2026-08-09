import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeSeoResult } from '../api/seo-contract.js'

function resultFixture(overrides = {}) {
  const images = [25, 50, 75].map((position, index) => ({
    image_id: `img-${index + 1}`,
    insert_after_pct: `${position}%`,
    measured_position_percent: `${position}%`,
    alt_text: `圖片 ${index + 1}`,
    prompt: `標籤甲、標籤乙、標籤丙`,
    asset_url: `https://quickchart.io/chart?c=${index + 1}`,
  }))
  const article = [
    `${'內容'.repeat(300)}。`,
    `![圖片 1](${images[0].asset_url})`,
    `${'內容'.repeat(290)}。`,
    `![圖片 2](${images[1].asset_url})`,
    `${'內容'.repeat(290)}。`,
    `![圖片 3](${images[2].asset_url})`,
  ].join('\n\n')
  return {
    request_id: 'test-1',
    keyword: '內容',
    product: '內容',
    scenario: '測試情境',
    generation_method: 'gemini-ai',
    folder_path: 'review/test/revised/',
    draft: { version: 'draft', title: '初稿', meta_description: '說明', article_markdown: '初稿內容' },
    revised: { version: 'revised', title: '修正版', meta_description: '說明', article_markdown: article, images },
    improvements: [1, 2, 3].map((point) => ({ point_no: point, observed_issue: `問題 ${point}`, fix_action: `修正 ${point}`, result: `結果 ${point}` })),
    content_warnings: [],
    ...overrides,
  }
}

test('normalizes a complete workflow response and recomputes PASS', () => {
  const result = normalizeSeoResult(resultFixture())
  assert.equal(result.ok, true)
  assert.equal(result.data.quality_gate, 'PASS')
  assert.equal(result.data.revised.images.length, 3)
  assert.equal(result.data.quality_checks.image_positions, true)
  assert.equal(result.data.quality_checks.input_coverage, true)
  assert.equal(result.data.quality_checks.unique_images, true)
})

test('rejects unsafe image origins', () => {
  const fixture = resultFixture()
  fixture.revised.images[1].asset_url = 'https://example.com/tracker.png'
  const result = normalizeSeoResult(fixture)
  assert.deepEqual(result, { ok: false, error: 'n8n 回傳缺少初稿、三點改善、修正版或三張圖。' })
})

test('rejects undeclared images embedded in article markdown', () => {
  const fixture = resultFixture()
  fixture.revised.article_markdown = fixture.revised.article_markdown.replace('https://quickchart.io/chart?c=2', 'https://evil.example/tracker.png')
  const result = normalizeSeoResult(fixture)
  assert.deepEqual(result, { ok: false, error: '文章內嵌圖片與安全圖片清單不一致。' })
})

test('downgrades quality when positions or content claims fail', () => {
  const fixture = resultFixture({ content_warnings: ['可能有未驗證宣稱'] })
  fixture.revised.images[0].measured_position_percent = '10%'
  const result = normalizeSeoResult(fixture)
  assert.equal(result.ok, true)
  assert.equal(result.data.quality_gate, 'REVIEW')
  assert.equal(result.data.quality_checks.image_positions, false)
  assert.equal(result.data.quality_checks.content_claims, false)
})

test('rejects incomplete workflow response structures', () => {
  assert.equal(normalizeSeoResult({ revised: {} }).ok, false)
})
