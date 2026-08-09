const limits = {
  keyword: 120,
  product: 120,
  scenario: 300,
  target_folder_key: 180,
}

const labels = {
  keyword: '關鍵字',
  product: '想賣的產品',
  scenario: '使用情境',
}

function cleanText(value) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\u2060\ufeff]/g, ' ').replace(/\s+/g, ' ').trim()
    : ''
}

export function sanitizeFolder(value) {
  const normalized = typeof value === 'string' ? value : ''
  return (normalized || 'formal-site/seo-tool')
    .trim()
    .replace(/[^a-zA-Z0-9_./-]/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, limits.target_folder_key)
}

export function validateSeoInput(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const fields = ['keyword', 'product', 'scenario']
  for (const field of fields) {
    const text = cleanText(source[field])
    if (!text) return { ok: false, error: `請填寫${labels[field]}。` }
    if ([...text].length > limits[field]) return { ok: false, error: `${labels[field]}超過 ${limits[field]} 字。` }
  }
  return {
    ok: true,
    value: {
      keyword: cleanText(source.keyword),
      product: cleanText(source.product),
      scenario: cleanText(source.scenario),
      target_folder_key: sanitizeFolder(source.target_folder_key),
    },
  }
}
