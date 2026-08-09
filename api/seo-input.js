const limits = {
  keyword: 120,
  product: 120,
  scenario: 300,
  target_folder_key: 180,
}

export function sanitizeFolder(value) {
  return String(value || 'formal-site/seo-tool')
    .trim()
    .replace(/[^a-zA-Z0-9_./-]/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, limits.target_folder_key)
}

export function validateSeoInput(value) {
  const source = value && typeof value === 'object' ? value : {}
  const fields = ['keyword', 'product', 'scenario']
  for (const field of fields) {
    const text = String(source[field] || '').trim()
    if (!text) return { ok: false, error: `缺少欄位：${field}` }
    if (text.length > limits[field]) return { ok: false, error: `${field} 超過長度限制` }
  }
  return {
    ok: true,
    value: {
      keyword: String(source.keyword).trim(),
      product: String(source.product).trim(),
      scenario: String(source.scenario).trim(),
      target_folder_key: sanitizeFolder(source.target_folder_key),
    },
  }
}
