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
