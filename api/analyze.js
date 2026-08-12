import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_ARTICLES = 10
const MAX_QUERY_LENGTH = 200
const DEFAULT_TIMEOUT_MS = 9000
const DEFAULT_PUBLIC_TEST_QUERY = '4G 吃到飽'
const DEFAULT_PUBLIC_TEST_COOLDOWN_MS = 30000
const MAX_SOURCE_REDIRECTS = 3
const MAX_PUBLIC_TEST_KEYS = 2048
const publicTestRuns = new Map()

const STOPWORDS = new Set([
  '可以', '以及', '這個', '這些', '我們', '你們', '他們', '如何', '什麼', '為什麼', '如果', '因此',
  '使用', '相關', '內容', '文章', '資料', '目前', '開始', '最後', '方式', '問題', '比較', '了解',
  '提供', '建議', '需要', '透過', '進行', '是否', '以及', '不過', '一個', '很多', '這樣', '更多',
  '首頁', '目錄', '網站', '網頁', '頁面', '本文', '全文', '閱讀', '閱讀全文', '分享', '收藏', '訂閱', '登入',
  '註冊', '搜尋', '查看', '點擊', '繼續', '返回', '上一頁', '下一頁', '載入', '錯誤', '選單', '留言', '評論',
  '作者', '日期', '時間', '更新', '版權', '隱私', '條款', '聯絡', '關於', '推薦', '立即', '更多資訊',
  '熱門', '熱門文章', '最新消息', '相關文章', '延伸閱讀', '導覽', '導覽列', '標籤', '分類', '頁碼', '回到頂端',
  '按讚', '轉發', '複製', '下載', '列印', '播放', '圖片', '影片',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'are', 'was', 'will', 'have',
  'about', 'into', 'than', 'then', 'when', 'where', 'what', 'which', 'how', 'not', 'our', 'their',
  'https', 'http', 'www', 'com', 'net', 'org', 'html', 'htm', 'php', 'css', 'js', 'json', 'xml', 'svg',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'cookie', 'cookies', 'share', 'login', 'logout', 'signup', 'search',
  'menu', 'header', 'footer', 'sidebar', 'related', 'recommend', 'comment', 'comments', 'page', 'next', 'prev',
  'previous', 'loading', 'error', 'home', 'url', 'utm', 'amp', 'api', 'breadcrumb', 'social', 'print', 'download',
  'pagination', 'tag', 'tags', 'category', 'categories', 'filter', 'sort', 'back', 'top', 'subscribe',
])

const TOPIC_RULES = [
  { topic: '資費與合約', keywords: ['月租', '資費', '價格', '費用', '合約', '續約', '攜碼', '違約', '方案', 'price', 'cost', 'contract', 'plan'] },
  { topic: '優惠與申辦', keywords: ['優惠', '折扣', '贈品', '申辦', '門市', '預付卡', '辦理', 'offer', 'signup'] },
  { topic: '網路與涵蓋', keywords: ['速度', '訊號', '涵蓋', '網路', '室內', '偏鄉', '基地台', 'coverage', 'speed', 'network'] },
  { topic: '條款與限制', keywords: ['降速', '不限速', '公平使用', '流量', '限制', '條款', '門檻', 'fair', 'throttle', 'limit'] },
  { topic: '裝置相容', keywords: ['手機', '裝置', 'iPhone', 'Android', '頻段', '設備', 'device', 'phone'] },
  { topic: '使用情境', keywords: ['學生', '影音', '遊戲', '通勤', '熱點', '分享', '家庭', 'student', 'video', 'gaming'] },
  { topic: '方案與技術', keywords: ['4G', '5G', 'LTE', '吃到飽', 'sim', 'SIM', 'mobile'] },
]

function env(name, fallback = '') {
  return process.env[name] || fallback
}

function getHeader(req, name) {
  const value = req?.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function publicClientKey(req) {
  const forwarded = getHeader(req, 'x-forwarded-for') || getHeader(req, 'x-real-ip') || 'unknown'
  return String(forwarded).split(',')[0].trim().slice(0, 128) || 'unknown'
}

function prunePublicTestRuns(now, cooldownMs) {
  const retentionMs = Math.max(cooldownMs * 4, DEFAULT_PUBLIC_TEST_COOLDOWN_MS)
  for (const [key, timestamp] of publicTestRuns) {
    if (now - timestamp > retentionMs) publicTestRuns.delete(key)
  }
  while (publicTestRuns.size >= MAX_PUBLIC_TEST_KEYS) {
    const oldest = publicTestRuns.keys().next().value
    if (oldest === undefined) break
    publicTestRuns.delete(oldest)
  }
}

function isPublicTestQueryAllowed(query, expectedQuery, allowAnyQuery) {
  return allowAnyQuery || query === expectedQuery
}

function setCors(req, res) {
  const origin = getHeader(req, 'origin')
  const allowedOrigins = env('APP_ORIGIN')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Script-Token')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
}

function json(res, status, payload) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.status(status).json(payload)
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function parseBody(req) {
  const rawBody = req?.body
  if (!rawBody) return {}
  if (isRecord(rawBody)) return rawBody
  if (typeof rawBody !== 'string') return {}
  try {
    const parsed = JSON.parse(rawBody)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function safeSource(link, fallback = '未知來源') {
  if (typeof link !== 'string') return fallback
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return fallback
  }
}

function normalizePublicHttpUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const parsed = new URL(value.trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

function safePositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeLocale(value, fallback) {
  const normalized = normalizeText(value).toLowerCase()
  return /^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(normalized) ? normalized : fallback
}

function requestTimeoutMs() {
  const configured = Number(env('REQUEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS))
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_TIMEOUT_MS
  return Math.min(Math.floor(configured), 20_000)
}

function isPrivateIp(address) {
  const normalized = String(address || '').replace(/^\[|\]$/g, '').toLowerCase()
  const version = isIP(normalized)
  if (version === 4) {
    const parts = normalized.split('.').map(Number)
    const [first, second] = parts
    return first === 0 || first === 10 || first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127)
  }
  if (version === 6) {
    const mappedIpv4 = normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : ''
    if (mappedIpv4 && isIP(mappedIpv4) === 4) return isPrivateIp(mappedIpv4)
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('ff') ||
      normalized.startsWith('::ffff:127.')
  }
  return true
}

async function isSafePublicUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return { safe: false, reason: '來源 URL 無效' }
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { safe: false, reason: '只接受 http/https 來源' }
  if (parsed.username || parsed.password) return { safe: false, reason: '來源 URL 不可包含帳號密碼' }
  if (parsed.port && !['80', '443'].includes(parsed.port)) return { safe: false, reason: '來源 URL 的 port 不被允許' }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === 'metadata.google.internal') {
    return { safe: false, reason: '已阻擋本機或雲端 metadata host' }
  }
  if (isIP(hostname)) return isPrivateIp(hostname)
    ? { safe: false, reason: '已阻擋私有或 loopback IP' }
    : { safe: true }
  try {
    const records = await lookup(hostname, { all: true, verbatim: true })
    if (!records.length || records.some((record) => isPrivateIp(record.address))) {
      return { safe: false, reason: '來源 host 解析到私有或 loopback IP' }
    }
    return { safe: true }
  } catch {
    return { safe: false, reason: '來源 host DNS 無法解析' }
  }
}

function normalizeText(value) {
  const raw = typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
    ? String(value)
    : ''
  return raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200d\u2060\ufeff]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function occurrenceCount(text, candidate) {
  if (!candidate) return 0
  const flags = /[A-Za-z]/.test(candidate) ? 'gi' : 'g'
  return text.match(new RegExp(escapeRegExp(candidate), flags))?.length || 0
}

function isNumericLikeToken(value) {
  return /^\d+(?:[.,/-]\d+)*$/.test(String(value || '').trim())
}

function canonicalEntityKey(value) {
  const normalized = normalizeText(value)
  return /[A-Za-z]/.test(normalized) ? normalized.toLowerCase() : normalized
}

function isStopword(value) {
  const normalized = String(value || '').trim()
  return STOPWORDS.has(normalized) || STOPWORDS.has(normalized.toLowerCase())
}

function isNoiseToken(value) {
  const normalized = String(value || '').trim()
  if (!normalized || isNumericLikeToken(normalized) || isStopword(normalized)) return true
  if (/^v?\d+(?:[._/-]\d+)+$/i.test(normalized)) return true
  if (/^\d{2,4}年(?:\d{1,2}月(?:\d{1,2}日?)?)?$/u.test(normalized)) return true
  if (/^\d+(?:[.,/-]\d+)*(?:年|月|日|號|元|塊|折|期|次|個|件|人|名|篇|頁|歲|天|週|周|小時|分鐘|分|秒|%|％)$/u.test(normalized)) return true
  if (/^第?\d+(?:名|位|項|題|頁|章|段|條|筆|篇)$/u.test(normalized)) return true
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(normalized)) return true
  return false
}

function classifyTopic(name) {
  const lowerName = name.toLowerCase()
  return TOPIC_RULES.find((rule) => rule.keywords.some((keyword) => lowerName.includes(keyword.toLowerCase())))?.topic || '其他'
}

function addChineseCandidates(text, candidateSet) {
  const knownKeywords = TOPIC_RULES.flatMap((rule) => rule.keywords)
    .filter((keyword) => /[\u3400-\u9fff]/.test(keyword) && keyword.length >= 2)
  for (const keyword of knownKeywords) {
    if (text.includes(keyword)) candidateSet.add(keyword)
  }

  if (typeof Intl.Segmenter === 'function') {
    try {
      const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' })
      for (const segment of segmenter.segment(text)) {
        const value = normalizeText(segment.segment)
        if (segment.isWordLike && /[\u3400-\u9fff]/.test(value) && value.length >= 3 && !isNoiseToken(value)) {
          candidateSet.add(value)
        }
      }
      return
    } catch {
      // Fall back to contiguous CJK runs when a runtime lacks the locale data.
    }
  }

  const runs = text.match(/[\u3400-\u9fff]{3,12}/g) || []
  for (const run of runs) {
    if (!isNoiseToken(run)) candidateSet.add(run)
  }
}

function addLatinCandidates(text, candidateSet) {
  const words = text.match(/[A-Za-z0-9][A-Za-z0-9+.-]*/g) || []
  for (const word of words) {
    const normalized = word.trim()
    if (
      normalized.length < 2 ||
      normalized.length > 40 ||
      isNoiseToken(normalized)
    ) continue
    candidateSet.add(normalized)
  }
}

function extractEntities(query, title, snippet, articleText) {
  const normalizedQuery = normalizeText(query)
  const normalizedTitle = normalizeText(title)
  const normalizedSnippet = normalizeText(snippet)
  const normalizedArticleText = normalizeText(articleText)
  const text = normalizeText(`${normalizedQuery} ${normalizedTitle} ${normalizedSnippet} ${normalizedArticleText}`).slice(0, 50000)
  const candidateSet = new Set()
  if (normalizedQuery.length >= 2 && normalizedQuery.length <= 30 && !isNoiseToken(normalizedQuery)) {
    candidateSet.add(normalizedQuery)
  }
  addChineseCandidates(text, candidateSet)
  addLatinCandidates(text, candidateSet)

  const canonicalCandidates = new Map()
  for (const candidate of candidateSet) {
    const key = canonicalEntityKey(candidate)
    if (!canonicalCandidates.has(key)) canonicalCandidates.set(key, candidate)
  }

  const scored = [...canonicalCandidates.values()]
    .map((name) => {
      const frequency = occurrenceCount(text, name)
      const inTitle = normalizedTitle.toLowerCase().includes(name.toLowerCase())
      const knownTopic = classifyTopic(name) !== '其他'
      const score = frequency * 4 + (inTitle ? 6 : 0) + (knownTopic ? 4 : 0) + Math.min(name.length, 8) / 10
      return { name, frequency, score, topic: classifyTopic(name) }
    })
    .filter((entity) => {
      if (isNoiseToken(entity.name)) return false
      const inTitle = title.toLowerCase().includes(entity.name.toLowerCase())
      const knownTopic = entity.topic !== '其他'
      const mixedToken = /[A-Za-z]/.test(entity.name) && /\d/.test(entity.name)
      return entity.frequency > 0 && (knownTopic || inTitle || entity.frequency >= 2 || mixedToken)
    })
    .sort((a, b) => b.score - a.score || b.frequency - a.frequency || a.name.localeCompare(b.name))
    .slice(0, 30)

  return scored.map(({ name, frequency, topic }) => ({ name, frequency, topic }))
}

async function fetchArticle(link) {
  let currentUrl = normalizePublicHttpUrl(link)
  if (!currentUrl) return { text: '', fetchStatus: 'URL 無效', error: '來源 URL 無效' }

  try {
    for (let redirectCount = 0; redirectCount <= MAX_SOURCE_REDIRECTS; redirectCount += 1) {
      const safety = await isSafePublicUrl(currentUrl)
      if (!safety.safe) return { text: '', fetchStatus: 'blocked', error: safety.reason }

      const response = await fetchWithTimeout(currentUrl, {
        headers: {
          'User-Agent': 'SERP-Entity-Desk/0.1 (+https://vercel.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
      }, requestTimeoutMs())

      if (response.status >= 300 && response.status < 400) {
        if (redirectCount === MAX_SOURCE_REDIRECTS) {
          return { text: '', fetchStatus: '重導向過多', error: '來源重導向次數過多' }
        }
        const location = response.headers?.get?.('location')
        if (!location) return { text: '', fetchStatus: '重導向無效', error: '來源重導向缺少目的地' }
        try {
          currentUrl = normalizePublicHttpUrl(new URL(location, currentUrl).toString())
        } catch {
          currentUrl = ''
        }
        if (!currentUrl) return { text: '', fetchStatus: 'URL 無效', error: '來源重導向目的地無效' }
        continue
      }

      if (!response.ok) return { text: '', fetchStatus: `HTTP ${response.status}`, error: `來源回傳 ${response.status}` }
      const contentType = response.headers.get('content-type') || ''
      if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return { text: '', fetchStatus: '非 HTML', error: '來源不是 HTML 文章' }
      }

      const html = (await response.text()).slice(0, 1_500_000)
      const $ = cheerio.load(html)
      $('script, style, noscript, nav, footer, header, aside, form, iframe, svg, [hidden], [aria-hidden="true"], [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="breadcrumb"], [id*="breadcrumb"], [class*="social"], [id*="social"], [class*="pagination"], [id*="pagination"]').remove()
      const candidates = $('article, main, [role="main"], .article, .article-content, .post-content, .entry-content, #content')
        .toArray()
        .map((node) => normalizeText($(node).text()))
        .filter((text) => text.length > 120)
      const text = (candidates.sort((a, b) => b.length - a.length)[0] || normalizeText($('body').text())).slice(0, 50000)
      if (text.length < 80) return { text, fetchStatus: '內容不足', error: '無法取得足夠正文' }
      return { text, fetchStatus: 'ok' }
    }
  } catch (error) {
    const message = error?.name === 'AbortError' ? '抓取逾時' : '抓取失敗'
    return { text: '', fetchStatus: message, error: message }
  }

  return { text: '', fetchStatus: '抓取失敗', error: '來源處理失敗' }
}

async function searchSerpApi(query, gl, hl) {
  const apiKey = env('SERPAPI_KEY')
  if (!apiKey) throw new Error('伺服器尚未設定 SERPAPI_KEY。')
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(MAX_ARTICLES))
  url.searchParams.set('gl', normalizeLocale(gl, 'tw'))
  url.searchParams.set('hl', normalizeLocale(hl, 'zh-tw'))
  url.searchParams.set('api_key', apiKey)
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, requestTimeoutMs())
  const payload = await response.json().catch(() => ({}))
  if (!isRecord(payload)) throw new Error('SerpApi 回傳格式無法解析。')
  if (!response.ok || payload.error) throw new Error(normalizeText(payload.error) || `SerpApi 回傳 ${response.status}`)
  return (Array.isArray(payload.organic_results) ? payload.organic_results : [])
    .map((item, index) => {
      const link = normalizePublicHttpUrl(item?.link)
      if (!link) return null
      return {
        link,
        title: normalizeText(item.title) || '未命名文章',
        snippet: normalizeText(item.snippet),
        source: normalizeText(item.source),
        position: safePositiveInteger(item.position, index + 1),
      }
    })
    .filter(Boolean)
    .slice(0, MAX_ARTICLES)
}

function aggregate(articles) {
  const entityMap = new Map()
  for (const article of articles) {
    for (const entity of article.entities) {
      const key = canonicalEntityKey(entity.name)
      const current = entityMap.get(key) || { name: entity.name, totalFrequency: 0, articleCount: 0, topic: entity.topic }
      current.totalFrequency += entity.frequency
      current.articleCount += 1
      entityMap.set(key, current)
    }
  }
  const entities = [...entityMap.values()].sort((a, b) => b.totalFrequency - a.totalFrequency || b.articleCount - a.articleCount)
  const clusters = new Map()
  for (const entity of entities) {
    const cluster = clusters.get(entity.topic) || { topic: entity.topic, entityCount: 0, totalFrequency: 0, entities: [] }
    cluster.entityCount += 1
    cluster.totalFrequency += entity.totalFrequency
    cluster.entities.push(entity)
    clusters.set(entity.topic, cluster)
  }
  return {
    entities,
    clusters: [...clusters.values()].sort((a, b) => b.totalFrequency - a.totalFrequency),
  }
}

async function verifyUser(authorization) {
  const token = typeof authorization === 'string' ? authorization.match(/^Bearer\s+(.+)$/i)?.[1] : null
  if (!token) return null
  const url = env('SUPABASE_URL')
  const anonKey = env('SUPABASE_ANON_KEY')
  if (!url || !anonKey) throw new Error('伺服器尚未設定 Supabase Auth 環境變數。')
  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

async function persistResult(result, userId) {
  const url = env('SUPABASE_URL')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey || !userId) return { persisted: false }
  try {
    const client = createClient(url, serviceKey)
    const { error } = await client.from('analysis_runs').insert({
      user_id: userId,
      query: result.query,
      source: result.source,
      mode: result.mode,
      article_count: result.summary.articleCount,
      entity_count: result.summary.entityCount,
      cluster_count: result.summary.clusterCount,
      payload: result,
    })
    if (error) {
      console.error('Supabase persistence failed:', error.message)
      return { persisted: false, persistenceError: 'Supabase 保存失敗，結果仍已回傳' }
    }
    return { persisted: true }
  } catch (error) {
    console.error('Supabase persistence failed:', error?.message || error)
    return { persisted: false, persistenceError: 'Supabase 保存失敗，結果仍已回傳' }
  }
}

async function analyze(query, gl, hl) {
  const serpResults = await searchSerpApi(query, gl, hl)
  const articles = await Promise.all(serpResults.map(async (item, index) => {
    const title = normalizeText(item.title) || '未命名文章'
    const snippet = normalizeText(item.snippet)
    const link = normalizePublicHttpUrl(item.link)
    const fallback = {
      position: safePositiveInteger(item.position, index + 1),
      title,
      source: normalizeText(item.source) || safeSource(link),
      link,
      snippet,
      fetchStatus: '分析失敗',
      fetchError: '文章處理失敗，已略過此來源正文。',
      entityCount: 0,
      entities: [],
    }
    try {
      const fetched = await fetchArticle(link)
      const entities = extractEntities(query, title, snippet, fetched.text)
      return {
        ...fallback,
        fetchStatus: fetched.fetchStatus,
        fetchError: fetched.error || null,
        entityCount: entities.length,
        entities,
      }
    } catch (error) {
      console.error('Article analysis failed:', error?.message || error)
      return fallback
    }
  }))
  const { entities, clusters } = aggregate(articles)
  return {
    query,
    source: 'serpapi',
    mode: 'live',
    createdAt: new Date().toISOString(),
    notice: articles.length
      ? 'entity 為文章標題、摘要與可取得正文的規則式候選；文章不可抓取時會保留狀態，不靜默補資料。'
      : '這次搜尋沒有取得 Google organic results；可以換一組更具體的關鍵字再試。',
    summary: {
      articleCount: articles.length,
      entityCount: entities.length,
      clusterCount: clusters.length,
      totalMentions: entities.reduce((sum, entity) => sum + entity.totalFrequency, 0),
    },
    articles,
    entities,
    clusters,
  }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return json(res, 405, { error: '只接受 POST。' })

  const body = parseBody(req)
  let serializedBody = ''
  try {
    serializedBody = JSON.stringify(body)
  } catch {
    return json(res, 400, { error: 'request body 格式無法解析。' })
  }
  if (serializedBody.length > 5000) return json(res, 413, { error: 'request body 過大。' })
  const query = normalizeText(body.query)
  if (!query || query.length > MAX_QUERY_LENGTH) return json(res, 400, { error: `query 必須是 1–${MAX_QUERY_LENGTH} 字元。` })

  const scriptToken = getHeader(req, 'x-app-script-token')
  const isScriptRequest = Boolean(env('APP_SCRIPT_TOKEN') && scriptToken && scriptToken === env('APP_SCRIPT_TOKEN'))
  const publicTestMode = env('PUBLIC_TEST_MODE') === 'true'
  const publicTestAllowAnyQuery = env('PUBLIC_TEST_ALLOW_ANY_QUERY') === 'true'
  const publicTestQuery = normalizeText(env('PUBLIC_TEST_QUERY', DEFAULT_PUBLIC_TEST_QUERY)) || DEFAULT_PUBLIC_TEST_QUERY
  const cooldownValue = Number(env('PUBLIC_TEST_COOLDOWN_MS', String(DEFAULT_PUBLIC_TEST_COOLDOWN_MS)))
  const publicTestCooldownMs = Number.isFinite(cooldownValue) && cooldownValue >= 0
    ? cooldownValue
    : DEFAULT_PUBLIC_TEST_COOLDOWN_MS
  let user = null
  if (!isScriptRequest && publicTestMode) {
    if (!isPublicTestQueryAllowed(query, publicTestQuery, publicTestAllowAnyQuery)) {
      return json(res, 403, { error: `公開測試模式只允許查詢「${publicTestQuery}」。` })
    }
    const key = publicClientKey(req)
    const now = Date.now()
    prunePublicTestRuns(now, publicTestCooldownMs)
    const lastRun = publicTestRuns.get(key) || 0
    const remainingMs = publicTestCooldownMs - (now - lastRun)
    if (remainingMs > 0) {
      res.setHeader('Retry-After', String(Math.ceil(remainingMs / 1000)))
      return json(res, 429, { error: '公開測試冷卻中，請稍後再試。' })
    }
    publicTestRuns.set(key, now)
  } else if (!isScriptRequest) {
    try {
      user = await verifyUser(getHeader(req, 'authorization'))
    } catch (error) {
      return json(res, 503, { error: error.message })
    }
    if (!user) return json(res, 401, { error: '請先登入，再執行 Live 分析。' })
  }

  try {
    const result = await analyze(query, body.gl || 'tw', body.hl || 'zh-tw')
    const persistence = body.persist === false || isScriptRequest || publicTestMode
      ? { persisted: false }
      : await persistResult(result, user.id)
    return json(res, 200, { result: { ...result, persistence } })
  } catch (error) {
    console.error('SERP Entity analysis failed:', error)
    const message = String(error?.message || '')
    const publicMessage = /aborted|abort|timeout|timed out|逾時/i.test(message)
      ? '搜尋服務回應逾時，請稍後再試。'
      : /429|rate limit|too many requests|請求過於頻繁/i.test(message)
        ? '搜尋服務目前請求過於頻繁，請稍後再試。'
        : /fetch failed|network|econn|enotfound|dns/i.test(message)
          ? '搜尋服務暫時無法連線，請稍後再試。'
          : message || 'SERP 分析失敗，請稍後再試。'
    return json(res, 502, { error: publicMessage })
  }
}

export { extractEntities, isPrivateIp, isSafePublicUrl, isPublicTestQueryAllowed, isNumericLikeToken, isNoiseToken }
