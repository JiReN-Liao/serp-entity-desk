import { useEffect, useRef, useState } from 'react'

const initialForm = {
  keyword: '台灣小型品牌內容行銷',
  product: '內容行銷顧問服務',
  scenario: '沒有專職編輯、每週只有三小時的小型電商',
  target_folder_key: 'formal-site/seo-demo',
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function ArticlePreview({ markdown }) {
  return String(markdown || '').split('\n').map((line, index) => {
    const image = line.match(/^!\[([^\]]*)\]\((.+)\)$/)
    if (image) return <figure key={`${image[2]}-${index}`}><img src={image[2]} alt={image[1]} loading="lazy" /><figcaption>{image[1]}</figcaption></figure>
    if (line.startsWith('# ')) return <h2 key={index}>{line.slice(2)}</h2>
    if (line.startsWith('## ')) return <h3 key={index}>{line.slice(3)}</h3>
    return line.trim() ? <p key={index}>{line}</p> : null
  })
}

export default function SeoToolPage({ session }) {
  const [form, setForm] = useState(initialForm)
  const [serviceState, setServiceState] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const mounted = useRef(true)

  async function checkHealth() {
    try {
      const response = await fetch('/api/seo-health', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json()
      const state = data.ready ? 'ready' : data.state === 'not_configured' ? 'not-configured' : 'starting'
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
  }, [])

  async function ensureReady() {
    if (await checkHealth()) return true
    setServiceState('starting')
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await sleep(5000)
      if (await checkHealth()) return true
    }
    return false
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const ready = await ensureReady()
      if (!ready) throw new Error('n8n 尚未完成喚醒，請一分鐘後再試。')
      const response = await fetch('/api/seo-generate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '產生失敗。')
      setResult(data)
    } catch (submitError) {
      setError(submitError.message || '產生失敗。')
    } finally {
      setBusy(false)
    }
  }

  const stateLabel = serviceState === 'ready'
    ? 'n8n 已就緒'
    : serviceState === 'not-configured'
      ? '正式服務尚未設定'
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
        <form className="seo-form" onSubmit={submit}>
          <div className="panel-heading"><div><p className="section-label">INPUT</p><h2>文章設定</h2></div><span className="quiet-tag">GEMINI AI</span></div>
          <label>關鍵字<input value={form.keyword} onChange={(event) => update('keyword', event.target.value)} maxLength="120" required /></label>
          <label>想賣的產品<input value={form.product} onChange={(event) => update('product', event.target.value)} maxLength="120" required /></label>
          <label>使用情境<textarea value={form.scenario} onChange={(event) => update('scenario', event.target.value)} maxLength="300" required /></label>
          <label>資料夾路徑<input value={form.target_folder_key} onChange={(event) => update('target_folder_key', event.target.value)} maxLength="180" required /></label>
          <button className="button primary full-width" type="submit" disabled={busy || serviceState === 'not-configured'}>{busy ? (serviceState === 'ready' ? 'n8n 執行中…' : '等待 n8n 喚醒…') : '產生文章與三張圖'}</button>
          <p className="seo-form-note">登入後由正式站轉送至 self-host n8n，再呼叫 Gemini。API key 只存在 n8n 環境變數，不會送到瀏覽器。</p>
        </form>

        <section className="seo-output" aria-live="polite">
          {error && <div className="seo-error" role="alert">{error}</div>}
          {!error && !result && <div className="seo-empty"><strong>結果會顯示在這裡</strong><span>文章、三張圖、修改紀錄與資料夾路由會由 n8n 一次回傳。</span></div>}
          {result && (
            <>
              <div className="seo-result-head">
                <div><p className="section-label">REVISED ARTICLE</p><h2>{result.revised.title}</h2></div>
                <div className="seo-meta"><span>{result.generation_method === 'gemini-ai' ? 'Gemini AI' : 'Workflow'}</span><span>{result.revised.char_count} 字</span><span>{result.revised.images.length} 張圖</span><span>{result.quality_gate}</span><span>{result.folder_path}</span></div>
              </div>
              <article className="seo-article"><ArticlePreview markdown={result.revised.article_markdown} /></article>
              <section className="seo-improvements">
                <h2>觀察後修正的三個地方</h2>
                <ol>{result.improvements.map((item) => <li key={item.point_no}><strong>{item.observed_issue}</strong><span>{item.fix_action}；{item.result}</span></li>)}</ol>
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
