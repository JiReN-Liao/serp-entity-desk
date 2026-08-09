const articleMinChars = 1750
const articleMaxChars = 2100
const targetPositions = [25, 50, 75]

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function text(value, maxLength = 10_000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function imageUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'quickchart.io' || parsed.username || parsed.password) return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

function measuredPosition(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? `${parsed}%` : `${fallback}%`
}

function articleCharacterCount(markdown) {
  return [...String(markdown || '').replace(/^!\[[^\n]*\]\([^\n]*\)\s*$/gm, '').trim()].length
}

function markdownImageUrls(markdown) {
  return [...String(markdown || '').matchAll(/^!\[[^\n]*\]\(([^\n]+)\)\s*$/gm)].map((match) => imageUrl(match[1]))
}

function normalizeArticle(value, includeImages) {
  if (!isRecord(value)) return null
  const articleMarkdown = text(value.article_markdown, 120_000)
  const title = text(value.title, 180)
  const metaDescription = text(value.meta_description, 240)
  if (!articleMarkdown || !title) return null

  const images = includeImages && Array.isArray(value.images)
    ? value.images.slice(0, 3).map((image, index) => {
      if (!isRecord(image)) return null
      const assetUrl = imageUrl(image.asset_url)
      const altText = text(image.alt_text, 180)
      if (!assetUrl || !altText) return null
      return {
        image_id: text(image.image_id, 80) || `img-${index + 1}`,
        insert_after_pct: `${targetPositions[index]}%`,
        measured_position_percent: measuredPosition(image.measured_position_percent, targetPositions[index]),
        alt_text: altText,
        prompt: text(image.prompt, 500),
        asset_url: assetUrl,
        folder_path: text(image.folder_path, 240),
      }
    }).filter(Boolean)
    : []

  return {
    version: text(value.version, 40),
    title,
    meta_description: metaDescription,
    article_markdown: articleMarkdown,
    char_count: articleCharacterCount(articleMarkdown),
    images,
  }
}

export function normalizeSeoResult(value) {
  if (!isRecord(value)) return { ok: false, error: 'n8n 回傳格式不正確。' }
  const draft = normalizeArticle(value.draft, false)
  const revised = normalizeArticle(value.revised, true)
  const improvements = Array.isArray(value.improvements)
    ? value.improvements.slice(0, 3).map((item, index) => {
      if (!isRecord(item)) return null
      const observedIssue = text(item.observed_issue, 500)
      const fixAction = text(item.fix_action, 500)
      const result = text(item.result, 500)
      return observedIssue && fixAction && result
        ? { point_no: index + 1, observed_issue: observedIssue, fix_action: fixAction, result }
        : null
    }).filter(Boolean)
    : []
  if (!draft || !revised || revised.images.length !== 3 || improvements.length !== 3) {
    return { ok: false, error: 'n8n 回傳缺少初稿、三點改善、修正版或三張圖。' }
  }
  const draftImageUrls = markdownImageUrls(draft.article_markdown)
  const revisedImageUrls = markdownImageUrls(revised.article_markdown)
  const declaredImageUrls = revised.images.map((image) => image.asset_url)
  if (draftImageUrls.length || revisedImageUrls.length !== 3 || revisedImageUrls.some((url, index) => !url || url !== declaredImageUrls[index])) {
    return { ok: false, error: '文章內嵌圖片與安全圖片清單不一致。' }
  }

  const warnings = Array.isArray(value.content_warnings)
    ? value.content_warnings.map((warning) => text(warning, 300)).filter(Boolean).slice(0, 5)
    : []
  const positions = revised.images.map((image) => Number.parseInt(image.measured_position_percent, 10))
  const keyword = text(value.keyword, 120)
  const product = text(value.product, 120)
  const articleText = `${revised.title}\n${revised.article_markdown}`
  const checks = {
    article_length: revised.char_count >= articleMinChars && revised.char_count <= articleMaxChars,
    image_count: revised.images.length === 3,
    image_positions: positions.every((position, index) => Math.abs(position - targetPositions[index]) <= 5),
    improvement_count: improvements.length === 3,
    input_coverage: Boolean(keyword && product && articleText.includes(keyword) && articleText.includes(product)),
    unique_images: new Set(revised.images.map((image) => `${image.asset_url}|${image.alt_text}`)).size === 3,
    content_claims: warnings.length === 0,
  }
  const qualityGate = Object.values(checks).every(Boolean) ? 'PASS' : 'REVIEW'

  return {
    ok: true,
    data: {
      request_id: text(value.request_id, 120),
      keyword,
      product,
      scenario: text(value.scenario, 300),
      generation_method: value.generation_method === 'gemini-ai' ? 'gemini-ai' : 'workflow',
      status: qualityGate,
      quality_gate: qualityGate,
      quality_checks: checks,
      content_warnings: warnings,
      folder_path: text(value.folder_path, 240),
      draft,
      improvements,
      revised,
    },
  }
}

export const seoContract = { articleMinChars, articleMaxChars, targetPositions }
