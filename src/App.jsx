import { useEffect, useMemo, useState } from 'react'
import { demoAllowed, publicTestAllowed, publicTestAllowAnyQuery, supabase } from './supabaseClient.js'
import { getDemoResult } from './demoData.js'

const defaultQuery = '4G 吃到飽'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value || '未知來源'
  }
}

function App() {
  const [session, setSession] = useState(null)
  const [isDemo, setIsDemo] = useState(false)
  const [authReady, setAuthReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setAuthReady(true)
      }
    }).catch(() => {
      if (active) setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!authReady) return <LoadingScreen />
  if (!session && !isDemo && !publicTestAllowed) {
    return <AuthScreen onDemo={() => setIsDemo(true)} />
  }

  return (
    <Dashboard
      session={session}
      isDemo={isDemo}
      isPublicTest={publicTestAllowed}
      allowAnyQuery={publicTestAllowAnyQuery}
      onDemoLogout={() => setIsDemo(false)}
    />
  )
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite">
      <div className="loading-mark">SE</div>
      <p>正在確認工作階段…</p>
    </main>
  )
}

function AuthScreen({ onDemo }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!supabase) {
      setError('尚未設定 Supabase；目前請使用展示模式，或先填入 .env.local。')
      return
    }
    setBusy(true)
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    if (mode === 'signup' && !result.data.session) {
      setMessage('註冊完成。若 Supabase 開啟 email confirmation，請先收信確認，再回到登入。')
    } else {
      setMessage('登入成功，正在載入分析工作台。')
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand-lockup">
          <span className="brand-mark">SE</span>
          <span>SERP Entity Desk</span>
        </div>
        <div className="intro-copy">
          <p className="kicker">SERP / ENTITY / EVIDENCE</p>
          <h1>把搜尋結果，整理成可以檢查的內容地圖。</h1>
          <p>
            以一個查詢詞開始，查看 Google 第一頁、逐篇 entity 候選與主題分群。
            這是第 6 題的可展示 prototype，資料來源與限制會一起顯示。
          </p>
        </div>
        <div className="intro-note">
          <span className="status-dot" />
          <span>Live 模式需要 SerpApi；登入由 Supabase Auth 管理。</span>
        </div>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="panel-heading">
          <div>
            <p className="section-label">WORKSPACE ACCESS</p>
            <h2 id="auth-title">{mode === 'login' ? '登入工作台' : '建立測試帳號'}</h2>
          </div>
          <span className="quiet-tag">Supabase Auth</span>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            密碼
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 6 個字元"
              minLength="6"
              required
            />
          </label>
          {error && <p className="form-message error" role="alert">{error}</p>}
          {message && <p className="form-message success" role="status">{message}</p>}
          <button className="button primary full-width" type="submit" disabled={busy || !supabase}>
            {busy ? '處理中…' : mode === 'login' ? '登入並開始分析' : '註冊測試帳號'}
          </button>
        </form>

        <div className="auth-divider"><span>或</span></div>
        {demoAllowed ? (
          <button className="button secondary full-width" type="button" onClick={onDemo}>
            進入展示模式
            <span className="button-note">使用固定範例資料，不呼叫外部 API</span>
          </button>
        ) : (
          <p className="config-hint">展示模式已關閉；請填入 Supabase 環境變數後登入。</p>
        )}
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
            setMessage('')
          }}
        >
          {mode === 'login' ? '還沒有帳號？建立測試帳號' : '已有帳號？返回登入'}
        </button>
      </section>
    </main>
  )
}

function Dashboard({ session, isDemo, isPublicTest, allowAnyQuery, onDemoLogout }) {
  const publicQueryLocked = isPublicTest && !allowAnyQuery
  const [query, setQuery] = useState(defaultQuery)
  const [result, setResult] = useState(isDemo ? getDemoResult(defaultQuery) : null)
  const [history, setHistory] = useState([])
  const [historyBusy, setHistoryBusy] = useState(!isDemo && !isPublicTest && Boolean(session))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function refreshHistory() {
    if (isDemo || isPublicTest || !session?.access_token) return
    setHistoryBusy(true)
    try {
      const response = await fetch('/api/history', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok) setHistory(body.history || [])
    } catch {
      // History is supplementary; a failed history request must not block analysis.
    } finally {
      setHistoryBusy(false)
    }
  }

  useEffect(() => {
    refreshHistory()
  }, [isDemo, isPublicTest, session?.access_token])

  async function runAnalysis(event) {
    event?.preventDefault()
    const nextQuery = publicQueryLocked ? defaultQuery : query.trim()
    if (nextQuery.length < 2) {
      setError('請輸入至少 2 個字元的查詢詞。')
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (isDemo) {
        setResult(getDemoResult(nextQuery))
        setNotice('展示資料已更新查詢標籤；接上 SerpApi 後才會取得即時結果。')
      } else {
        const headers = { 'Content-Type': 'application/json' }
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: nextQuery, gl: 'tw', hl: 'zh-tw', persist: !isPublicTest }),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || `分析失敗（${response.status}）`)
        setResult(body.result || body)
        await refreshHistory()
        setNotice(isPublicTest
          ? '公開測試完成；本次結果不會保存到 Supabase 歷史。'
          : '分析完成；若已設定 Supabase，結果也會保存到 analysis_runs。')
      }
    } catch (runError) {
      setError(runError.message || '分析失敗，請稍後再試。')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (isDemo) {
      onDemoLogout()
      return
    }
    if (isPublicTest) {
      window.location.reload()
      return
    }
    await supabase?.auth.signOut()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <span className="brand-mark">SE</span>
          <span className="brand-name">Entity Desk</span>
        </div>
        <div className="sidebar-context">
          <span className="sidebar-caption">CURRENT WORKSPACE</span>
          <strong>SEO Content Signals</strong>
          <span className="sidebar-description">SERP → entities → topics</span>
        </div>
        <div className="history-block" aria-label="最近分析">
          <span className="sidebar-caption">RECENT ANALYSIS</span>
          {isDemo || isPublicTest ? (
            <p className="history-empty">{isDemo ? '展示模式不保存歷史。' : '公開測試不保存歷史。'}</p>
          ) : historyBusy ? (
            <p className="history-empty">讀取歷史…</p>
          ) : history.length ? (
            <div className="history-list">
              {history.map((item) => (
                <button
                  className="history-item"
                  type="button"
                  key={item.id}
                  title={`載入 ${item.query}`}
                  onClick={() => {
                    setQuery(item.query)
                    setNotice(`已載入歷史查詢「${item.query}」，按開始分析可重新取得結果。`)
                  }}
                >
                  <strong>{item.query}</strong>
                  <span>{item.articleCount} 篇 · {item.entityCount} entities</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="history-empty">完成一次 Live 分析後會出現在這裡。</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="source-status">
            <span className={isDemo || isPublicTest ? 'status-dot demo' : 'status-dot'} />
            <div>
              <strong>{isDemo ? '展示模式' : isPublicTest ? '公開測試模式' : 'Live workspace'}</strong>
              <span>{isDemo ? '固定資料' : isPublicTest ? (allowAnyQuery ? '任意 query / 不保存' : '固定 query / 不保存') : 'Supabase session'}</span>
            </div>
          </div>
          <button className="sidebar-logout" type="button" onClick={logout}>{isPublicTest ? '重新整理' : '登出'}</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="section-label">ANALYSIS WORKSPACE</p>
            <h1>SERP Entity Desk</h1>
          </div>
          <div className="topbar-meta">
            <span className="quiet-tag">{isDemo ? 'DEMO DATA' : isPublicTest ? 'PUBLIC TEST' : 'AUTHENTICATED'}</span>
            <span className="last-run">{result ? `更新於 ${formatDate(result.createdAt)}` : '尚未執行分析'}</span>
          </div>
        </header>

        <section className="query-panel" aria-labelledby="query-title">
          <div className="query-copy">
            <p className="section-label">START WITH A QUERY</p>
            <h2 id="query-title">查詢 Google 第一頁</h2>
            <p>{isPublicTest
              ? (allowAnyQuery
                ? '公開測試可輸入任意關鍵字，不要求登入，也不保存分析歷史。'
                : '公開測試僅允許「4G 吃到飽」，不要求登入，也不保存分析歷史。')
              : '可輸入任意關鍵字；Live 模式會從伺服器端呼叫 SerpApi，避免把金鑰送到瀏覽器。'}</p>
          </div>
          <form className="query-form" onSubmit={runAnalysis}>
            <label className="sr-only" htmlFor="query">搜尋關鍵字</label>
            <input
              id="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：4G 吃到飽"
              maxLength="200"
              readOnly={publicQueryLocked}
            />
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? '分析中…' : '開始分析'}
            </button>
          </form>
          <div className="query-meta">
            <span>地區：台灣（gl=tw）</span>
            <span>語言：繁體中文（hl=zh-tw）</span>
            <span>{isPublicTest
              ? (allowAnyQuery ? '公開測試：任意查詢、不保存' : '公開測試：固定查詢、不保存')
              : '範圍：organic results 前 10 筆'}</span>
          </div>
        </section>

        {isPublicTest && <div className="alert info" role="status">公開測試模式：{allowAnyQuery ? '可查任意關鍵字' : '只允許「4G 吃到飽」'}，每次分析結果不會寫入 Supabase。</div>}
        {error && <div className="alert error" role="alert">{error}</div>}
        {notice && <div className="alert info" role="status">{notice}</div>}
        {result ? <ResultView result={result} /> : <EmptyState onRun={runAnalysis} />}
      </main>
    </div>
  )
}

function EmptyState({ onRun }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-index">01</div>
      <div>
        <p className="section-label">NO ANALYSIS YET</p>
        <h2 id="empty-title">先跑一次查詢，讓資料自己長出結構。</h2>
        <p>結果會包含每篇文章的 entity 候選數、整體頻率與規則式主題分群。</p>
        <button className="button secondary" type="button" onClick={onRun}>用目前查詢開始</button>
      </div>
    </section>
  )
}

function ResultView({ result }) {
  const topEntities = useMemo(() => result.entities.slice(0, 10), [result.entities])
  const maxFrequency = Math.max(...topEntities.map((entity) => entity.totalFrequency), 1)

  return (
    <div className="result-stack">
      <section className="result-heading">
        <div>
          <div className="result-title-line">
            <p className="section-label">RESULT / {result.source === 'demo' ? 'STATIC EXAMPLE' : 'SERPAPI'}</p>
            <span className={result.source === 'demo' ? 'badge warning' : 'badge success'}>
              {result.source === 'demo' ? '展示資料' : 'Live result'}
            </span>
          </div>
          <h2>{result.query}</h2>
          <p>{result.notice || '以下數字來自本次分析回應；點進來源可人工抽查文章。'}</p>
        </div>
        <div className="result-time">{formatDate(result.createdAt)}</div>
      </section>

      <section className="summary-strip" aria-label="分析摘要">
        <div className="summary-item"><span>第一頁文章</span><strong>{result.summary.articleCount}</strong><small>organic results</small></div>
        <div className="summary-item"><span>Entity 候選</span><strong>{result.summary.entityCount}</strong><small>unique terms</small></div>
        <div className="summary-item"><span>總提及次數</span><strong>{result.summary.totalMentions}</strong><small>across articles</small></div>
        <div className="summary-item"><span>主題群組</span><strong>{result.summary.clusterCount}</strong><small>rule-based topics</small></div>
      </section>

      <div className="analysis-grid">
        <section className="panel entity-panel" aria-labelledby="entity-title">
          <div className="panel-heading compact">
            <div>
              <h3 id="entity-title">出現最頻繁的候選</h3>
            </div>
            <span className="panel-caption">依文章內容計算</span>
          </div>
          <div className="bar-list">
            {topEntities.map((entity) => (
              <div className="bar-row" key={entity.name}>
                <div className="bar-label"><strong>{entity.name}</strong><span>{entity.articleCount} 篇</span></div>
                <div className="bar-track" aria-label={`${entity.name} ${entity.totalFrequency} 次`}>
                  <span className="bar-fill" style={{ width: `${(entity.totalFrequency / maxFrequency) * 100}%` }} />
                </div>
                <strong className="bar-value">{entity.totalFrequency}</strong>
              </div>
            ))}
          </div>
          <p className="method-note">一次在同一篇文章出現多次會累計頻率；articleCount 則只算是否出現在該篇。</p>
        </section>

        <section className="panel cluster-panel" aria-labelledby="cluster-title">
          <div className="panel-heading compact">
            <div>
              <h3 id="cluster-title">Entity 主題分群</h3>
            </div>
            <span className="panel-caption">規則式 MVP</span>
          </div>
          <div className="cluster-list">
            {result.clusters.map((cluster, index) => (
              <div className="cluster-row" key={cluster.topic}>
                <span className={`cluster-index cluster-${index % 5}`}>{String(index + 1).padStart(2, '0')}</span>
                <div className="cluster-content">
                  <div className="cluster-title"><strong>{cluster.topic}</strong><span>{cluster.entityCount} entities · {cluster.totalFrequency} mentions</span></div>
                  <div className="entity-pills">
                    {cluster.entities.slice(0, 5).map((entity) => <span key={entity.name}>{entity.name}</span>)}
                    {cluster.entities.length > 5 && <span>+{cluster.entities.length - 5}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel article-panel" aria-labelledby="article-title">
        <div className="panel-heading article-heading">
          <div>
            <h3 id="article-title">逐篇文章 entity 個數</h3>
          </div>
          <span className="panel-caption">每列可回到來源抽查</span>
        </div>
        <div className="article-table-wrap">
          <table>
            <thead>
              <tr><th scope="col">排名</th><th scope="col">文章</th><th scope="col">來源</th><th scope="col">Entities</th><th scope="col">狀態</th></tr>
            </thead>
            <tbody>
              {result.articles.map((article) => (
                <tr key={`${article.position}-${article.link}`}>
                  <td className="rank-cell">{String(article.position).padStart(2, '0')}</td>
                  <td className="article-cell">
                    <a href={article.link} target="_blank" rel="noreferrer">{article.title}</a>
                    <span>{article.snippet || '未提供摘要'}</span>
                    {article.entities?.length > 0 && <div className="table-entities">{article.entities.slice(0, 4).map((entity) => <span key={entity.name}>{entity.name}</span>)}</div>}
                  </td>
                  <td className="source-cell">{article.source || domainFromUrl(article.link)}</td>
                  <td className="count-cell"><strong>{article.entityCount}</strong><span>候選</span></td>
                  <td><span className={article.fetchStatus === 'ok' ? 'badge success' : 'badge neutral'}>{article.fetchStatus || '已處理'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="result-footer">
        <span>抽取方式：{result.mode === 'demo' ? '固定展示資料' : '文章正文 + 規則式候選抽取'}</span>
        <span>Entity 是候選詞，不應直接當作完整 NER 結果。</span>
      </footer>
    </div>
  )
}

export default App
