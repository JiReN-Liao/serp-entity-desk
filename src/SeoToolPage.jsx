import { useEffect, useRef, useState } from 'react'

const initialForm = {
  keyword: '台灣小型品牌內容行銷',
  product: '內容行銷顧問服務',
  scenario: '沒有專職編輯、每週只有三小時的小型電商',
  target_folder_key: 'formal-site/seo-demo',
}

const qualityLabels = {
  article_length: '文章長度',
  image_count: '三張圖片',
  image_positions: '圖片位置',
  improvement_count: '三點改善',
  input_coverage: '輸入對應',
  unique_images: '圖片差異',
  content_claims: '宣稱檢查',
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeText(value, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
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

async function requestJson(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
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
    options.signal?.removeEventListener('abort', abort)
  }
}

function apiError(data, status, fallback) {
  return isRecord(data) && safeText(data.error) ? safeText(data.error) : `${fallback}（${status}）`
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function ArticlePreview({ markdown, compact = false }) {
  return safeText(markdown).split('\n').map((line, index) => {
    const cleanLine = line.trim()
    const image = cleanLine.match(/^!\[([^\]]*)\]\((.+)\)$/)
    const imageUrl = image ? safeImageUrl(image[2]) : ''
    if (image && imageUrl) return <figure key={`${imageUrl}-${index}`}><img src={imageUrl} alt={image[1] || '資訊圖'} loading="lazy" referrerPolicy="no-referrer" /><figcaption>{image[1] || '資訊圖'}</figcaption></figure>
    if (cleanLine.startsWith('# ')) return <h2 key={index}>{cleanLine.slice(2)}</h2>
    if (cleanLine.startsWith('## ')) return <h3 key={index}>{cleanLine.slice(3)}</h3>
    return cleanLine ? <p className={compact ? 'compact' : undefined} key={index}>{cleanLine}</p> : null
  })
}

export default function SeoToolPage({ session }) {
  const [form, setForm] = useState(initialForm)
  const [serviceState, setServiceState] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [copyError, setCopyError] = useState('')
  const mounted = useRef(true)
  const requestController = useRef(null)
  const resultHeading = useRef(null)

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
    return () => {
      mounted.current = false
      requestController.current?.abort()
    }
  }, [session.access_token])

  useEffect(() => {
    if (!busy) return undefined
    setElapsed(0)
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [busy])

  useEffect(() => {
    if (result) resultHeading.current?.focus()
  }, [result])

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
    requestController.current?.abort()
    requestController.current = new AbortController()
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
        signal: requestController.current.signal,
      }, 60_000)
      if (!response.ok) throw new Error(apiError(data, response.status, '產生失敗'))
      if (!isRecord(data) || !isRecord(data.revised)) throw new Error('內容服務回傳格式不完整，請稍後再試。')
      if (mounted.current) setResult(data)
    } catch (submitError) {
      if (submitError?.name !== 'AbortError' && mounted.current) setError(submitError.message || '產生失敗。')
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
      window.setTimeout(() => { if (mounted.current) setCopied(false) }, 1800)
    } catch {
      if (mounted.current) setCopyError('瀏覽器無法存取剪貼簿，請改用下載 Markdown。')
    }
  }

  function downloadArticle() {
    if (!result?.revised?.article_markdown) return
    const safeName = form.keyword.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'seo-article'
    const blob = new Blob([result.revised.article_markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeName}.md`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  function resetForm() {
    requestController.current?.abort()
    setForm(initialForm)
    setResult(null)
    setError('')
    setCopyError('')
    setBusy(false)
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
          <label>關鍵字<input value={form.keyword} onChange={(event) => update('keyword', event.target.value)} maxLength="120" autoComplete="off" required /><small>{[...form.keyword].length}/120</small></label>
          <label>想賣的產品<input value={form.product} onChange={(event) => update('product', event.target.value)} maxLength="120" autoComplete="off" required /><small>{[...form.product].length}/120</small></label>
          <label>使用情境<textarea value={form.scenario} onChange={(event) => update('scenario', event.target.value)} maxLength="300" required /><small>{[...form.scenario].length}/300</small></label>
          <label>資料夾路徑<input value={form.target_folder_key} onChange={(event) => update('target_folder_key', event.target.value)} maxLength="180" autoComplete="off" required /><small>邏輯路由，方便區分每次結果</small></label>
          <button className="button primary full-width" type="submit" disabled={busy || serviceState === 'not-configured' || serviceState === 'auth-error'}>{busy ? (serviceState === 'ready' ? 'n8n 執行中…' : '等待 n8n 喚醒…') : '產生文章與三張圖'}</button>
          <button className="text-button seo-reset" type="button" onClick={resetForm} disabled={busy}>重設展示內容</button>
          <p className="seo-form-note">登入後由正式站轉送至 self-host n8n，再呼叫 Gemini。API key 只存在 n8n 環境變數，不會送到瀏覽器。</p>
        </form>

        <section className="seo-output" aria-live="polite" aria-busy={busy}>
          {error && <div className="seo-error" role="alert"><strong>這次沒有完成</strong><span>{error}</span><button className="text-button" type="button" onClick={() => setError('')}>關閉提示</button></div>}
          {!error && !result && !busy && <div className="seo-empty"><strong>結果會顯示在這裡</strong><span>文章、三張圖、修改紀錄與資料夾路由會由 n8n 一次回傳。</span></div>}
          {!error && !result && busy && <div className="seo-progress" role="status"><strong>正在建立內容</strong><small>已執行 {elapsed} 秒，通常約 15–40 秒完成。</small><span>Gemini 撰寫初稿</span><span>檢查三個改善點</span><span>插入資訊圖並執行品質閘門</span></div>}
          {result && (
            <>
              <div className="seo-result-head">
                <div><p className="section-label">REVISED ARTICLE</p><h2 ref={resultHeading} tabIndex="-1">{result.revised.title}</h2><p className="seo-description">{result.revised.meta_description}</p></div>
                <div className="seo-result-actions"><button className="button secondary compact" type="button" onClick={copyArticle}>{copied ? '已複製' : '複製 Markdown'}</button><button className="button secondary compact" type="button" onClick={downloadArticle}>下載 .md</button>{copyError && <span className="seo-copy-error" role="status">{copyError}</span>}</div>
                <div className="seo-meta"><span>{result.generation_method === 'gemini-ai' ? 'Gemini AI' : 'Workflow'}</span><span>{result.revised.char_count} 字</span><span>{result.revised.images.length} 張圖</span><span className={result.quality_gate === 'PASS' ? 'pass' : 'review'}>{result.quality_gate}</span><span>{result.folder_path}</span></div>
                <div className="seo-position-row" aria-label="圖片實際插入位置">{result.revised.images.map((image, index) => <span key={image.image_id}>圖 {index + 1} · {image.measured_position_percent || image.insert_after_pct}</span>)}</div>
                <div className="seo-quality-checks" aria-label="品質檢查">{Object.entries(result.quality_checks || {}).map(([key, passed]) => <span className={passed ? 'passed' : 'failed'} key={key}>{passed ? '✓' : '!'} {qualityLabels[key] || key}</span>)}</div>
              </div>
              {result.content_warnings?.length > 0 && <div className="seo-warning"><strong>發布前需人工確認</strong>{result.content_warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
              <article className="seo-article"><ArticlePreview markdown={result.revised.article_markdown} /></article>
              <section className="seo-improvements">
                <h2>觀察後修正的三個地方</h2>
                <ol>{result.improvements.length
                  ? result.improvements.map((item) => <li key={item.point_no}><strong>{item.observed_issue}</strong><dl><div><dt>修正</dt><dd>{item.fix_action}</dd></div><div><dt>結果</dt><dd>{item.result}</dd></div></dl></li>)
                  : <li><strong>尚未收到改善紀錄</strong><span>請在發布前人工確認內容與 workflow 回傳。</span></li>}</ol>
              </section>
              <details className="seo-draft">
                <summary>查看 Gemini 初稿 · {result.draft.char_count} 字</summary>
                <div><p className="seo-description">{result.draft.meta_description}</p><ArticlePreview markdown={result.draft.article_markdown} compact /></div>
              </details>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
