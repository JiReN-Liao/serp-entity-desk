import { useEffect, useMemo, useRef, useState } from 'react'
import { demoAllowed, publicTestAllowed, publicTestAllowAnyQuery, supabase } from './supabaseClient.js'
import { getDemoResult } from './demoData.js'
import { displayAccount, resolveLoginEmail } from './authIdentifier.js'
import SeoToolPage from './SeoToolPage.jsx'

const defaultQuery = '4G 吃到飽'

function getAuthRedirectUrl() {
  return window.location.origin
}

function authErrorMessage(error, fallback = '驗證失敗，請稍後再試。') {
  const message = String(error?.message || '')
  if (/invalid login credentials/i.test(message)) return '帳號或密碼不正確。'
  if (/email not confirmed/i.test(message)) return '這個 Email 尚未完成驗證，請先查看信箱。'
  if (/user already registered/i.test(message)) return '這個 Email 已註冊，請直接登入或使用忘記密碼。'
  if (/password should be at least/i.test(message)) return '密碼長度不足，請使用至少 6 個字元。'
  if (/rate limit|too many requests/i.test(message)) return '操作太頻繁，請稍後再試。'
  return message || fallback
}

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

const ANALYSIS_REQUEST_TIMEOUT_MS = 55_000
const HISTORY_REQUEST_TIMEOUT_MS = 12_000

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

function safeHttpHref(value) {
  if (typeof value !== 'string') return ''
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function normalizeArticleEntity(value) {
  if (!isRecord(value)) return null
  const name = safeText(value.name)
  return name ? { name, frequency: safeCount(value.frequency), topic: safeText(value.topic, '其他') } : null
}

function normalizeGlobalEntity(value) {
  if (!isRecord(value)) return null
  const name = safeText(value.name)
  return name
    ? {
      name,
      totalFrequency: safeCount(value.totalFrequency),
      articleCount: safeCount(value.articleCount),
      topic: safeText(value.topic, '其他'),
    }
    : null
}

function normalizeAnalysisResult(value, fallbackQuery) {
  if (!isRecord(value) || !isRecord(value.summary) || !Array.isArray(value.articles) || !Array.isArray(value.entities) || !Array.isArray(value.clusters)) {
    return null
  }
  const articles = value.articles.map((article, index) => {
    if (!isRecord(article)) return null
    return {
      position: safeCount(article.position) || index + 1,
      title: safeText(article.title, '未命名文章'),
      source: safeText(article.source, '未知來源'),
      link: safeHttpHref(article.link),
      snippet: safeText(article.snippet),
      fetchStatus: safeText(article.fetchStatus, '已處理'),
      fetchError: safeText(article.fetchError) || null,
      entityCount: safeCount(article.entityCount),
      entities: Array.isArray(article.entities) ? article.entities.map(normalizeArticleEntity).filter(Boolean) : [],
    }
  }).filter(Boolean)
  const entities = value.entities.map(normalizeGlobalEntity).filter(Boolean)
  const clusters = value.clusters.map((cluster) => {
    if (!isRecord(cluster)) return null
    return {
      topic: safeText(cluster.topic, '其他'),
      entityCount: safeCount(cluster.entityCount),
      totalFrequency: safeCount(cluster.totalFrequency),
      entities: Array.isArray(cluster.entities) ? cluster.entities.map(normalizeGlobalEntity).filter(Boolean) : [],
    }
  }).filter(Boolean)
  return {
    query: safeText(value.query, fallbackQuery),
    source: safeText(value.source, 'serpapi'),
    mode: safeText(value.mode, 'live'),
    createdAt: safeText(value.createdAt),
    notice: safeText(value.notice, '分析完成。'),
    summary: {
      articleCount: safeCount(value.summary.articleCount),
      entityCount: safeCount(value.summary.entityCount),
      clusterCount: safeCount(value.summary.clusterCount),
      totalMentions: safeCount(value.summary.totalMentions),
    },
    articles,
    entities,
    clusters,
    persistence: isRecord(value.persistence) ? value.persistence : { persisted: false },
  }
}

async function fetchJson(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const raw = await response.text()
    let body = {}
    if (raw.trim()) {
      try {
        body = JSON.parse(raw)
      } catch {
        body = {}
      }
    }
    return { response, body }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('請求逾時，請稍後再試。')
    throw new Error('目前無法連線到服務，請稍後再試。')
  } finally {
    window.clearTimeout(timer)
  }
}

function apiErrorMessage(body, status, fallback) {
  const message = isRecord(body) ? safeText(body.error) : ''
  return message || `${fallback}（${status}）`
}

function App() {
  const isSeoTool = window.location.pathname.replace(/\/+$/, '') === '/seo-tool'
  const [session, setSession] = useState(null)
  const [isDemo, setIsDemo] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
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
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      setAuthReady(true)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!authReady) return <LoadingScreen />
  if (passwordRecovery && session) {
    return <PasswordRecoveryScreen onComplete={() => setPasswordRecovery(false)} />
  }
  if (!session && (isSeoTool || (!isDemo && !publicTestAllowed))) {
    return <AuthScreen onDemo={() => setIsDemo(true)} />
  }
  if (isSeoTool && session) return <SeoToolPage session={session} />

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
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isLogin = mode === 'login'
  const isSignup = mode === 'signup'
  const isRecovery = mode === 'recovery'
  const title = isLogin ? '登入工作台' : isSignup ? '建立測試帳號' : '重設密碼'

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!supabase) {
      setError('尚未設定 Supabase；目前請使用展示模式，或先填入 .env.local。')
      return
    }
    const cleanIdentifier = email.trim().toLowerCase()
    if (!cleanIdentifier) {
      setError(isLogin ? '請輸入帳號或 Email。' : '請輸入 Email。')
      return
    }
    if (!isLogin && !cleanIdentifier.includes('@')) {
      setError('註冊或重設密碼時請輸入 Email。')
      return
    }
    const cleanEmail = isLogin ? resolveLoginEmail(cleanIdentifier) : cleanIdentifier
    if (isSignup && password !== confirmPassword) {
      setError('兩次輸入的密碼不一致。')
      return
    }

    setBusy(true)
    try {
      if (isRecovery) {
        const result = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: getAuthRedirectUrl(),
        })
        if (result.error) {
          setError(authErrorMessage(result.error, '無法寄送重設信件。'))
          return
        }
        setMode('login')
        setMessage('如果此 Email 有對應帳號，重設密碼連結會寄到你的信箱。')
        return
      }

      const result = isLogin
        ? await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        : await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: getAuthRedirectUrl() },
        })
      if (result.error) {
        setError(authErrorMessage(result.error, isLogin ? '登入失敗。' : '註冊失敗。'))
        return
      }
      if (isSignup && !result.data?.session) {
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setMessage('註冊完成。請先查看信箱完成驗證，再回到這裡登入。')
      } else {
        setMessage('登入成功，正在載入分析工作台。')
      }
    } catch (submitError) {
      setError(authErrorMessage(submitError, isRecovery ? '無法寄送重設信件。' : '驗證失敗。'))
    } finally {
      setBusy(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
    setMessage('')
    setPassword('')
    setConfirmPassword('')
    setPasswordVisible(false)
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
        <a className="auth-tool-link" href="/seo-tool">查看第 7 題 SEO 內容產生器 →</a>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="panel-heading">
          <div>
            <p className="section-label">WORKSPACE ACCESS</p>
            <h2 id="auth-title">{title}</h2>
          </div>
          <span className="quiet-tag">Supabase Auth</span>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="auth-email">
            {isLogin ? '帳號或 Email' : 'Email'}
            <input
              id="auth-email"
              type={isLogin ? 'text' : 'email'}
              autoComplete={isLogin ? 'username' : 'email'}
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={isLogin ? '輸入測試帳號或 Email' : 'you@example.com'}
              required
            />
          </label>
          {!isRecovery && (
            <label htmlFor="auth-password">
              密碼
              <span className="password-field">
                <input
                  id="auth-password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 個字元"
                  minLength="6"
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={passwordVisible ? '隱藏密碼' : '顯示密碼'}
                  aria-pressed={passwordVisible}
                >
                  {passwordVisible ? '隱藏' : '顯示'}
                </button>
              </span>
            </label>
          )}
          {isSignup && (
            <label htmlFor="auth-confirm-password">
              確認密碼
              <input
                id="auth-confirm-password"
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再次輸入密碼"
                minLength="6"
                required
              />
            </label>
          )}
          {isLogin && (
            <button className="text-button auth-forgot" type="button" onClick={() => switchMode('recovery')}>
              忘記密碼？寄送重設連結
            </button>
          )}
          {error && <p className="form-message error" role="alert">{error}</p>}
          {message && <p className="form-message success" role="status">{message}</p>}
          <button className="button primary full-width" type="submit" disabled={busy || !supabase}>
            {busy ? '處理中…' : isLogin ? '登入並開始分析' : isSignup ? '註冊測試帳號' : '寄送重設連結'}
          </button>
        </form>

        {isRecovery ? (
          <button className="text-button" type="button" onClick={() => switchMode('login')}>
            返回登入
          </button>
        ) : (
          <>
            <div className="auth-divider"><span>或</span></div>
            {demoAllowed ? (
              <button className="button secondary full-width" type="button" onClick={onDemo}>
                進入展示模式
                <span className="button-note">使用固定範例資料，不呼叫外部 API</span>
              </button>
            ) : (
              <p className="config-hint">展示模式已關閉；請使用測試帳號或 Supabase 帳號登入。</p>
            )}
            <button className="text-button" type="button" onClick={() => switchMode(isLogin ? 'signup' : 'login')}>
              {isLogin ? '還沒有帳號？建立測試帳號' : '已有帳號？返回登入'}
            </button>
          </>
        )}
      </section>
    </main>
  )
}

function PasswordRecoveryScreen({ onComplete }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致。')
      return
    }
    setBusy(true)
    try {
      const result = await supabase.auth.updateUser({ password })
      if (result.error) {
        setError(authErrorMessage(result.error, '無法更新密碼。'))
        return
      }
      window.history.replaceState({}, document.title, window.location.pathname)
      onComplete()
    } catch (updateError) {
      setError(authErrorMessage(updateError, '無法更新密碼。'))
    } finally {
      setBusy(false)
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
          <p className="kicker">ACCOUNT RECOVERY</p>
          <h1>設定新的工作台密碼。</h1>
          <p>更新完成後，原本的登入工作階段會繼續使用。</p>
        </div>
        <div className="intro-note"><span className="status-dot" /><span>密碼只交給 Supabase Auth 處理。</span></div>
      </section>
      <section className="auth-panel" aria-labelledby="recovery-title">
        <div className="panel-heading">
          <div>
            <p className="section-label">ACCOUNT RECOVERY</p>
            <h2 id="recovery-title">設定新密碼</h2>
          </div>
          <span className="quiet-tag">Supabase Auth</span>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="recovery-password">
            新密碼
            <span className="password-field">
              <input
                id="recovery-password"
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 個字元"
                minLength="6"
                required
                autoFocus
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={passwordVisible ? '隱藏密碼' : '顯示密碼'}
                aria-pressed={passwordVisible}
              >
                {passwordVisible ? '隱藏' : '顯示'}
              </button>
            </span>
          </label>
          <label htmlFor="recovery-confirm-password">
            確認新密碼
            <input
              id="recovery-confirm-password"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="再次輸入新密碼"
              minLength="6"
              required
            />
          </label>
          {error && <p className="form-message error" role="alert">{error}</p>}
          <button className="button primary full-width" type="submit" disabled={busy || !supabase}>
            {busy ? '更新中…' : '更新密碼'}
          </button>
        </form>
      </section>
    </main>
  )
}

function Dashboard({ session, isDemo, isPublicTest, allowAnyQuery, onDemoLogout }) {
  const publicQueryLocked = isPublicTest && !allowAnyQuery
  const [query, setQuery] = useState(defaultQuery)
  const [result, setResult] = useState(isDemo ? getDemoResult(defaultQuery) : null)
  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const [historyBusy, setHistoryBusy] = useState(!isDemo && !isPublicTest && Boolean(session))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(true)

  useEffect(() => () => {
    mounted.current = false
  }, [])

  async function refreshHistory() {
    if (isDemo || isPublicTest || !session?.access_token) return
    setHistoryBusy(true)
    try {
      const { response, body } = await fetchJson('/api/history', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }, HISTORY_REQUEST_TIMEOUT_MS)
      if (!mounted.current) return
      if (response.ok && isRecord(body) && Array.isArray(body.history)) {
        setHistory(body.history.filter(isRecord).map((item) => ({
          id: safeText(item.id) || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          query: safeText(item.query, '未命名查詢'),
          createdAt: safeText(item.createdAt),
          articleCount: safeCount(item.articleCount),
          entityCount: safeCount(item.entityCount),
        })))
        setHistoryError('')
      } else {
        setHistoryError(response.ok ? '歷史資料格式異常。' : apiErrorMessage(body, response.status, '無法讀取歷史分析'))
      }
    } catch {
      setHistoryError('無法連線到歷史分析；仍可繼續執行新查詢。')
    } finally {
      if (mounted.current) setHistoryBusy(false)
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
        const { response, body } = await fetchJson('/api/analyze', {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: nextQuery, gl: 'tw', hl: 'zh-tw', persist: !isPublicTest }),
        }, ANALYSIS_REQUEST_TIMEOUT_MS)
        if (!response.ok) throw new Error(apiErrorMessage(body, response.status, '分析失敗'))
        const nextResult = normalizeAnalysisResult(isRecord(body) ? body.result || body : null, nextQuery)
        if (!nextResult) throw new Error('分析服務回傳格式異常，請稍後再試。')
        if (!mounted.current) return
        setResult(nextResult)
        await refreshHistory()
        setNotice(isPublicTest
          ? '公開測試完成；本次結果不會保存到 Supabase 歷史。'
          : nextResult.persistence?.persisted
            ? '分析完成，結果已保存到你的歷史分析。'
            : nextResult.persistence?.persistenceError || '分析完成，但歷史尚未保存；請確認 Supabase schema。')
      }
    } catch (runError) {
      if (mounted.current) setError(runError.message || '分析失敗，請稍後再試。')
    } finally {
      if (mounted.current) setBusy(false)
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
    <>
      <a className="skip-link" href="#main-content">跳到主要內容</a>
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
          <a className="sidebar-tool-link" href="/seo-tool">第 7 題 · SEO 內容工具</a>
        </div>
        <div className="history-block" aria-label="最近分析">
          <span className="sidebar-caption">RECENT ANALYSIS</span>
          {isDemo || isPublicTest ? (
            <p className="history-empty">{isDemo ? '展示模式不保存歷史。' : '公開測試不保存歷史。'}</p>
          ) : historyBusy ? (
            <p className="history-empty">讀取歷史…</p>
          ) : historyError ? (
            <p className="history-empty">{historyError}</p>
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
              {!isDemo && !isPublicTest && session?.user?.email && <span className="session-email">{displayAccount(session.user.email)}</span>}
            </div>
          </div>
          <button className="sidebar-logout" type="button" onClick={logout}>{isPublicTest ? '重新整理' : '登出'}</button>
        </div>
      </aside>

      <main className="main-content" id="main-content" aria-busy={busy}>
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

        {busy && <div className="alert info" role="status">正在抓取 Google 第一頁、讀取可取得的文章正文並整理 entity，請稍候…</div>}
        {isPublicTest && <div className="alert info" role="status">公開測試模式：{allowAnyQuery ? '可查任意關鍵字' : '只允許「4G 吃到飽」'}，每次分析結果不會寫入 Supabase。</div>}
        {error && (
          <div className="alert error alert-with-action" role="alert">
            <span>{error}</span>
            <button className="text-button alert-action" type="button" onClick={() => runAnalysis()}>再試一次</button>
          </div>
        )}
        {notice && <div className="alert info" role="status">{notice}</div>}
        {result ? <ResultView result={result} /> : <EmptyState onRun={runAnalysis} />}
      </main>
      </div>
    </>
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
            {topEntities.length ? topEntities.map((entity) => (
              <div className="bar-row" key={entity.name}>
                <div className="bar-label"><strong>{entity.name}</strong><span>{entity.articleCount} 篇</span></div>
                <progress className="bar-track" max={maxFrequency} value={entity.totalFrequency} aria-label={`${entity.name} ${entity.totalFrequency} 次`} />
                <strong className="bar-value">{entity.totalFrequency}</strong>
              </div>
            )) : <p className="result-empty-copy">這次沒有可展示的 entity，請換一組更具體的關鍵字。</p>}
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
            {result.clusters.length ? result.clusters.map((cluster, index) => (
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
            )) : <p className="result-empty-copy">目前沒有可分群的候選詞。</p>}
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
              {result.articles.length ? result.articles.map((article) => (
                <tr key={`${article.position}-${article.link}`}>
                  <td className="rank-cell">{String(article.position).padStart(2, '0')}</td>
                  <td className="article-cell">
                    {article.link
                      ? <a href={article.link} target="_blank" rel="noreferrer">{article.title}</a>
                      : <strong className="article-title">{article.title}</strong>}
                    <span>{article.snippet || '未提供摘要'}</span>
                    {article.entities?.length > 0 && <div className="table-entities">{article.entities.slice(0, 4).map((entity) => <span key={entity.name}>{entity.name}</span>)}</div>}
                  </td>
                  <td className="source-cell">{article.source || domainFromUrl(article.link)}</td>
                  <td className="count-cell"><strong>{article.entityCount}</strong><span>候選</span></td>
                  <td><span className={article.fetchStatus === 'ok' ? 'badge success' : 'badge neutral'}>{article.fetchStatus || '已處理'}</span></td>
                </tr>
              )) : <tr><td className="result-empty-row" colSpan="5">這次搜尋沒有取得 Google organic results，請換一組關鍵字再試。</td></tr>}
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
