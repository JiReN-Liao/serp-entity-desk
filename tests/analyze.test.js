import test from 'node:test'
import assert from 'node:assert/strict'
import analyzeHandler, { extractEntities, isPrivateIp, isSafePublicUrl, isPublicTestQueryAllowed, isNumericLikeToken, isNoiseToken } from '../api/analyze.js'
import historyHandler from '../api/history.js'

function mockResponse(resolve) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(body) { resolve({ status: this.statusCode, body }) },
    end() { resolve({ status: this.statusCode, body: null }) },
  }
}

test('blocks private and loopback IP ranges', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true)
  assert.equal(isPrivateIp('10.0.0.4'), true)
  assert.equal(isPrivateIp('172.16.0.9'), true)
  assert.equal(isPrivateIp('192.168.1.20'), true)
  assert.equal(isPrivateIp('::1'), true)
  assert.equal(isPrivateIp('8.8.8.8'), false)
})

test('rejects unsafe article URL shapes before DNS lookup', async () => {
  assert.deepEqual(await isSafePublicUrl('http://127.0.0.1:3000/admin'), {
    safe: false,
    reason: '來源 URL 的 port 不被允許',
  })
  assert.deepEqual(await isSafePublicUrl('http://127.0.0.1/admin'), {
    safe: false,
    reason: '已阻擋私有或 loopback IP',
  })
  assert.deepEqual(await isSafePublicUrl('https://user:password@example.com'), {
    safe: false,
    reason: '來源 URL 不可包含帳號密碼',
  })
})

test('keeps query terms and classifies useful entity candidates', () => {
  const entities = extractEntities(
    '4G 吃到飽',
    '4G 吃到飽方案與月租比較',
    '比較網路速度與熱點分享限制。',
    '4G 吃到飽適合通勤使用，月租與網路速度是主要考量。4G 方案也會受到降速條款影響。',
  )
  const names = new Set(entities.map((entity) => entity.name))
  assert.equal(names.has('4G 吃到飽'), true)
  assert.equal(names.has('4G'), true)
  assert.equal(entities.every((entity) => entity.frequency > 0 && entity.topic), true)
  assert.equal(entities.some((entity) => entity.topic === '資費與合約'), true)
})

test('filters numeric noise while keeping meaningful mixed tokens', () => {
  const entities = extractEntities(
    '4G 吃到飽',
    '4G 吃到飽方案推薦 2026',
    '月租 20、流量 100GB、速度 5G，更新日期 2026-08-09。',
    '方案價格 10 20 12 60 100 2026，版本 2.33.4；支援 4G、5G 與 20GB 流量。',
  )
  const names = new Set(entities.map((entity) => entity.name))
  for (const value of ['10', '12', '20', '60', '100', '2026', '2.33.4']) {
    assert.equal(names.has(value), false, `numeric token leaked: ${value}`)
    assert.equal(isNumericLikeToken(value), true)
  }
  assert.equal(names.has('4G'), true)
  assert.equal(names.has('5G'), true)
  assert.equal(names.has('20GB'), true)
  assert.equal(isNumericLikeToken('4G'), false)
})

test('filters common web boilerplate and one-off latin noise for other queries', () => {
  const entities = extractEntities(
    '台北咖啡店',
    '台北咖啡店推薦 2026',
    '首頁 分享 收藏 閱讀全文 https www cookie login。',
    '台北咖啡店提供手沖咖啡與甜點。歡迎使用網站搜尋、登入、分享；地址 100 號。版本 2.33.4。咖啡店適合平日休息。',
  )
  const names = new Set(entities.map((entity) => entity.name))
  for (const value of ['100', '2026', '2.33.4', 'https', 'www', 'cookie', 'login', 'share']) {
    assert.equal(names.has(value), false, `boilerplate token leaked: ${value}`)
  }
  assert.equal(names.has('台北咖啡店'), true)
  assert.equal(names.has('咖啡店'), true)
  assert.equal(isNoiseToken('https'), true)
  assert.equal(isNoiseToken('4G'), false)
})

test('filters number-plus-unit fragments without removing meaningful product tokens', () => {
  for (const value of ['2026年', '2026年8月9日', '100元', '3個', '第10名', '25%']) {
    assert.equal(isNoiseToken(value), true, `number fragment leaked: ${value}`)
  }
  for (const value of ['4G', '5G', '20GB', '100Mbps', '3C']) {
    assert.equal(isNoiseToken(value), false, `meaningful mixed token was filtered: ${value}`)
  }
})

test('merges case variants of the same Latin entity', () => {
  const entities = extractEntities(
    'iPhone 16',
    'iPhone 16 手機比較',
    'iphone 與 IPHONE 的裝置相容性比較。',
    'iPhone 適合日常使用；iphone 的裝置生態與支援服務也會影響選擇。',
  )
  assert.equal(entities.filter((entity) => entity.name.toLowerCase() === 'iphone').length, 1)
})

test('entity extraction tolerates missing or non-text source fields', () => {
  assert.doesNotThrow(() => extractEntities(null, undefined, { title: 'not text' }, ['unexpected']))
  assert.deepEqual(extractEntities(null, undefined, { title: 'not text' }, ['unexpected']), [])
})

test('malformed request bodies return validation errors instead of throwing', async () => {
  for (const body of [null, [], 'not-json', '{"query":']) {
    const response = await new Promise((resolve) => analyzeHandler(
      { method: 'POST', headers: {}, body },
      mockResponse(resolve),
    ))
    assert.equal(response.status, 400)
    assert.match(response.body.error, /query 必須/)
  }
})

test('returns a stable empty result when SERP has no organic results', async () => {
  const previousMode = process.env.PUBLIC_TEST_MODE
  const previousAllowAny = process.env.PUBLIC_TEST_ALLOW_ANY_QUERY
  const previousCooldown = process.env.PUBLIC_TEST_COOLDOWN_MS
  const previousKey = process.env.SERPAPI_KEY
  const previousFetch = globalThis.fetch
  try {
    process.env.PUBLIC_TEST_MODE = 'true'
    process.env.PUBLIC_TEST_ALLOW_ANY_QUERY = 'true'
    process.env.PUBLIC_TEST_COOLDOWN_MS = '0'
    process.env.SERPAPI_KEY = 'test-key'
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ organic_results: [] }) })
    const response = await new Promise((resolve) => analyzeHandler(
      { method: 'POST', headers: {}, body: { query: '沒有結果的測試' } },
      mockResponse(resolve),
    ))
    assert.equal(response.status, 200)
    assert.equal(response.body.result.summary.articleCount, 0)
    assert.deepEqual(response.body.result.articles, [])
    assert.deepEqual(response.body.result.entities, [])
    assert.match(response.body.result.notice, /沒有取得/)
  } finally {
    if (previousMode === undefined) delete process.env.PUBLIC_TEST_MODE
    else process.env.PUBLIC_TEST_MODE = previousMode
    if (previousAllowAny === undefined) delete process.env.PUBLIC_TEST_ALLOW_ANY_QUERY
    else process.env.PUBLIC_TEST_ALLOW_ANY_QUERY = previousAllowAny
    if (previousCooldown === undefined) delete process.env.PUBLIC_TEST_COOLDOWN_MS
    else process.env.PUBLIC_TEST_COOLDOWN_MS = previousCooldown
    if (previousKey === undefined) delete process.env.SERPAPI_KEY
    else process.env.SERPAPI_KEY = previousKey
    globalThis.fetch = previousFetch
  }
})

test('keeps article rows when individual source fetches fail', async () => {
  const previousMode = process.env.PUBLIC_TEST_MODE
  const previousAllowAny = process.env.PUBLIC_TEST_ALLOW_ANY_QUERY
  const previousCooldown = process.env.PUBLIC_TEST_COOLDOWN_MS
  const previousKey = process.env.SERPAPI_KEY
  const previousFetch = globalThis.fetch
  try {
    process.env.PUBLIC_TEST_MODE = 'true'
    process.env.PUBLIC_TEST_ALLOW_ANY_QUERY = 'true'
    process.env.PUBLIC_TEST_COOLDOWN_MS = '0'
    process.env.SERPAPI_KEY = 'test-key'
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.startsWith('https://serpapi.com/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ organic_results: [
            { position: 1, link: 'https://8.8.8.8/first', title: '第一篇', snippet: '' },
            { position: 2, link: 'https://8.8.8.8/second', title: '第二篇', snippet: '' },
          ] }),
        }
      }
      if (url.endsWith('/first')) return { ok: false, status: 503 }
      throw new Error('source offline')
    }
    const response = await new Promise((resolve) => analyzeHandler(
      { method: 'POST', headers: {}, body: { query: '來源失敗測試' } },
      mockResponse(resolve),
    ))
    assert.equal(response.status, 200)
    assert.equal(response.body.result.summary.articleCount, 2)
    assert.equal(response.body.result.articles.length, 2)
    assert.equal(response.body.result.articles.every((article) => article.entityCount >= 0), true)
    assert.equal(response.body.result.articles.some((article) => article.fetchStatus !== 'ok'), true)
  } finally {
    if (previousMode === undefined) delete process.env.PUBLIC_TEST_MODE
    else process.env.PUBLIC_TEST_MODE = previousMode
    if (previousAllowAny === undefined) delete process.env.PUBLIC_TEST_ALLOW_ANY_QUERY
    else process.env.PUBLIC_TEST_ALLOW_ANY_QUERY = previousAllowAny
    if (previousCooldown === undefined) delete process.env.PUBLIC_TEST_COOLDOWN_MS
    else process.env.PUBLIC_TEST_COOLDOWN_MS = previousCooldown
    if (previousKey === undefined) delete process.env.SERPAPI_KEY
    else process.env.SERPAPI_KEY = previousKey
    globalThis.fetch = previousFetch
  }
})

test('history route rejects unauthenticated requests', async () => {
  const response = await new Promise((resolve) => historyHandler(
    { method: 'GET', headers: {} },
    mockResponse(resolve),
  ))
  assert.equal(response.status, 401)
})

test('public test mode rejects queries outside its fixed test query when any-query is off', async () => {
  const previousMode = process.env.PUBLIC_TEST_MODE
  const previousAllowAny = process.env.PUBLIC_TEST_ALLOW_ANY_QUERY
  const previousQuery = process.env.PUBLIC_TEST_QUERY
  try {
    process.env.PUBLIC_TEST_MODE = 'true'
    process.env.PUBLIC_TEST_ALLOW_ANY_QUERY = 'false'
    process.env.PUBLIC_TEST_QUERY = '4G 吃到飽'
    const response = await new Promise((resolve) => analyzeHandler(
      { method: 'POST', headers: {}, body: { query: '另一個查詢' } },
      mockResponse(resolve),
    ))
    assert.equal(response.status, 403)
    assert.match(response.body.error, /只允許查詢/)
  } finally {
    if (previousMode === undefined) delete process.env.PUBLIC_TEST_MODE
    else process.env.PUBLIC_TEST_MODE = previousMode
    if (previousAllowAny === undefined) delete process.env.PUBLIC_TEST_ALLOW_ANY_QUERY
    else process.env.PUBLIC_TEST_ALLOW_ANY_QUERY = previousAllowAny
    if (previousQuery === undefined) delete process.env.PUBLIC_TEST_QUERY
    else process.env.PUBLIC_TEST_QUERY = previousQuery
  }
})

test('public test mode can allow arbitrary queries when toggled on', () => {
  assert.equal(isPublicTestQueryAllowed('另一個查詢', '4G 吃到飽', true), true)
  assert.equal(isPublicTestQueryAllowed('另一個查詢', '4G 吃到飽', false), false)
})
