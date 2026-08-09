import { useEffect, useRef, useState } from 'react'

const initialForm = {
  keyword: '台灣小型品牌內容行銷',
  product: '內容行銷顧問服務',
  scenario: '沒有專職編輯、每週只有三小時的小型電商',
  target_folder_key: 'formal-site/seo-demo',
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeText(value, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function safeCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
}

function safeImageUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function normalizeSeoResult(value) {
  if (!isRecord(value) || !isRecord(value.revised)) return null
  const revised = value.revised
  const articleMarkdown = safeText(revised.article_markdown)
  if (!articleMarkdown) return null
  const draft = isRecord(value.draft) ? value.draft : {}
  const images = Array.isArray(revised.images) ? revised.images.map((image, index) => {
    if (!isRecord(image)) return null
    return {
      image_id: safeText(image.image_id, `image-${index + 1}`),
      image_url: safeImageUrl(image.image_url),
      alt_text: safeText(image.alt_text, `資訊圖 ${index + 1}`),
      insert_after_pct: safeText(image.insert_after_pct, `${[25, 50, 75][index] || 75}%`),
      measured_position_percent: safeText(image.measured_position_percent, safeText(image.insert_after_pct)),
    }
  }).filter(Boolean) : []
  return {
    generation_method: safeText(value.generation_method, 'workflow'),
    quality_gate: safeText(value.quality_gate, 'REVIEW'),
    folder_path: safeText(value.folder_path, 'formal-site/seo-tool'),
    revised: {
      title: safeText(revised.title, '未命名文章'),
      meta_description: safeText(revised.meta_description, '尚未提供 meta description。'),
      char_count: safeCount(revised.char_count),
      images,
      article_markdown: articleMarkdown,
    },
    draft: {
      meta_description: safeText(draft.meta_description),
      article_markdown: safeText(draft.article_markdown),
    },
    improvements: Array.isArray(value.improvements) ? value.improvements.map((item, index) => {
      if (!isRecord(item)) return null
      return {
        point_no: safeCount(item.point_no) || index + 1,
        observed_issue: safeText(item.observed_issue, '待確認問題'),
        fix_action: safeText(item.fix_action, '待補充修正'),
        result: safeText(item.result, '待人工確認'),
      }
    }).filter(Boolean) : [],
    content_warnings: Array.isArray(value.content_warnings)
      ? value.content_warnings.map((warning) => safeText(warning)).filter(Boolean)
      : [],
  }
}

async function requestJson(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const raw = await response.text()
    let data = {}
    if (raw.trim()) {
      try {
        const parsed = JSON.parse(raw)
        data = isRecord(parsed) ? parsed : {}
      } catch {
        data = {}
      }
    }
    return { response, data }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('服務回應逾時，請稍後再試。')
    throw new Error('目前無法連線到內容服務，請稍後再試。')
  } finally {
    window.clearTimeout(timer)
  }
}

function apiError(data, status, fallback) {
  return isRecord(data) && safeText(data.error) ? safeText(data.error) : `${fallback}（${status}）`
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function ArticlePreview({ markdown }) {
  return safeText(markdown).split('\n').map((line, index) => {
    const cleanLine = line.trim()
    const image = cleanLine.match(/^!\[([^\]]*)\]\((.+)\)$/)
    const imageUrl = image ? safeImageUrl(image[2]) : ''
    if (image && imageUrl) return <figure key={`${imageUrl}-${index}`}><img src={imageUrl} alt={image[1] || '資訊圖'} loading="lazy" referrerPolicy="no-referrer" /><figcaption>{image[1] || '資訊圖'}</figcaption></figure>
    if (cleanLine.startsWith('# ')) return <h2 key={index}>{cleanLine.slice(2)}</h2>
    if (cleanLine.startsWith('## ')) return <h3 key={index}>{cleanLine.slice(3)}</h3>
    return cleanLine ? <p key={index}>{cleanLine}</p> : null
  })
}

export default function SeoToolPage({ session }) {
  const [form, setForm] = useState(initialForm)
  const [serviceState, setServiceState] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const mounted = useRef(true)

  async function checkHealth() {
    try {
      const { response, data } = await requestJson('/api/seo-health', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }, 10_000)
      const state = response.status === 401 || data.state === 'unauthorized'
        ? 'auth-error'
        : response.ok && data.ready
          ? 'ready'
          : data.state === 'not_configured'
            ? 'not-configured'
            : 'starting'
      if (mounted.current) setServiceState(state)
      return data.ready
    } catch {
      if (mounted.current) setServiceState('starting')
      return false
    }
  }

  useEffect(() => {
    mounted.current = true
    checkHealth()
    return () => { mounted.current = false }
  }, [session.access_token])

  async function ensureReady() {
    if (await checkHealth()) return true
    if (mounted.current) setServiceState('starting')
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await sleep(5000)
      if (!mounted.current) return false
      if (await checkHealth()) return true
    }
    return false
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setResult(null)
    setCopied(false)
    setCopyError('')
    try {
      const ready = await ensureReady()
      if (!ready) throw new Error('n8n 尚未完成喚醒，請一分鐘後再試。')
      const { response, data } = await requestJson('/api/seo-generate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      }, 60_000)
      if (!response.ok) throw new Error(apiError(data, response.status, '產生失敗'))
      const normalized = normalizeSeoResult(data)
      if (!normalized) throw new Error('內容服務回傳格式不完整，請稍後再試。')
      if (mounted.current) setResult(normalized)
    } catch (submitError) {
      if (mounted.current) setError(submitError.message || '產生失敗。')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function copyArticle() {
    if (!result?.revised?.article_markdown) return
    setCopyError('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(result.revised.article_markdown)
      if (!mounted.current) return
      setCopied(true)
      window.setTimeout(() => {
        if (mounted.current) setCopied(false)
      }, 1800)
    } catch {
      if (mounted.current) setCopyError('瀏覽器目前不允許剪貼簿存取，請手動選取文章內容。')
    }
  }

  const stateLabel = serviceState === 'ready'
    ? 'n8n 已就緒'
    : serviceState === 'not-configured'
      ? '正式服務尚未設定'
      : serviceState === 'auth-error'
        ? '登入狀態已失效'
      : serviceState === 'starting'
        ? 'n8n 喚醒中'
        : '檢查 n8n 狀態'

  return (
    <main className="seo-page">
      <header className="seo-header">
        <a className="seo-back" href="/">← SERP Entity Desk</a>
        <span className={`seo-service-state ${serviceState}`}><span />{stateLabel}</span>
      </header>

      <section className="seo-intro">
        <div>
          <p className="section-label">N8N CONTENT WORKFLOW</p>
          <h1>SEO 內容產生器</h1>
          <p>輸入關鍵字、產品與實際情境，產生約 1,800 字文章、三張資訊圖、25%／50%／75% 插入位置、三點改善與修正版。</p>
        </div>
        <a className="button secondary" href="https://github.com/JiReN-Liao/n8n-seo-content-tool-demo" target="_blank" rel="noreferrer">查看 n8n workflow</a>
      </section>

      <div className="seo-workspace">
        <form className="seo-form" onSubmit={submit} aria-busy={busy}>
          <div className="panel-heading"><div><p className="section-label">INPUT</p><h2>文章設定</h2></div><span className="quiet-tag">GEMINI AI</span></div>
          <label>關鍵字<input value={form.keyword} onChange={(event) => update('keyword', event.target.value)} maxLength="120" required /></label>
          <label>想賣的產品<input value={form.product} onChange={(event) => update('product', event.target.value)} maxLength="120" required /></label>
          <label>使用情境<textarea value={form.scenario} onChange={(event) => update('scenario', event.target.value)} maxLength="300" required /></label>
          <label>資料夾路徑<input value={form.target_folder_key} onChange={(event) => update('target_folder_key', event.target.value)} maxLength="180" required /></label>
          <button className="button primary full-width" type="submit" disabled={busy || serviceState === 'not-configured' || serviceState === 'auth-error'}>{busy ? (serviceState === 'ready' ? 'n8n 執行中…' : '等待 n8n 喚醒…') : '產生文章與三張圖'}</button>
          <p className="seo-form-note">登入後由正式站轉送至 self-host n8n，再呼叫 Gemini。API key 只存在 n8n 環境變數，不會送到瀏覽器。</p>
        </form>

        <section className="seo-output" aria-live="polite" aria-busy={busy}>
          {error && <div className="seo-error" role="alert">{error}</div>}
          {!error && !result && !busy && <div className="seo-empty"><strong>結果會顯示在這裡</strong><span>文章、三張圖、修改紀錄與資料夾路由會由 n8n 一次回傳。</span></div>}
          {!error && !result && busy && <div className="seo-progress" role="status"><strong>正在建立內容</strong><span>Gemini 撰寫初稿</span><span>檢查三個改善點</span><span>插入資訊圖並執行品質閘門</span></div>}
          {result && (
            <>
              <div className="seo-result-head">
                <div><p className="section-label">REVISED ARTICLE</p><h2>{result.revised.title}</h2><p className="seo-description">{result.revised.meta_description}</p></div>
                <div className="seo-result-actions"><button className="button secondary compact" type="button" onClick={copyArticle}>{copied ? '已複製' : '複製 Markdown'}</button>{copyError && <span className="seo-copy-error" role="status">{copyError}</span>}</div>
                <div className="seo-meta"><span>{result.generation_method === 'gemini-ai' ? 'Gemini AI' : 'Workflow'}</span><span>{result.revised.char_count} 字</span><span>{result.revised.images.length} 張圖</span><span className={result.quality_gate === 'PASS' ? 'pass' : 'review'}>{result.quality_gate}</span><span>{result.folder_path}</span></div>
                <div className="seo-position-row" aria-label="圖片實際插入位置">{result.revised.images.map((image, index) => <span key={image.image_id}>圖 {index + 1} · {image.measured_position_percent || image.insert_after_pct}</span>)}</div>
              </div>
              {result.content_warnings?.length > 0 && <div className="seo-warning"><strong>發布前需人工確認</strong>{result.content_warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
              <article className="seo-article"><ArticlePreview markdown={result.revised.article_markdown} /></article>
              <section className="seo-improvements">
                <h2>觀察後修正的三個地方</h2>
                <ol>{result.improvements.length
                  ? result.improvements.map((item) => <li key={item.point_no}><strong>{item.observed_issue}</strong><span>{item.fix_action}；{item.result}</span></li>)
                  : <li><strong>尚未收到改善紀錄</strong><span>請在發布前人工確認內容與 workflow 回傳。</span></li>}</ol>
              </section>
              <details className="seo-draft">
                <summary>查看 Gemini 初稿</summary>
                <div><p className="seo-description">{result.draft.meta_description}</p><ArticlePreview markdown={result.draft.article_markdown} /></div>
              </details>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
