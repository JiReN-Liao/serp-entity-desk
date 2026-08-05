import test from 'node:test'
import assert from 'node:assert/strict'
import { extractEntities, isPrivateIp, isSafePublicUrl } from './analyze.js'
import historyHandler from './history.js'

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

test('history route rejects unauthenticated requests', async () => {
  const response = await new Promise((resolve) => historyHandler(
    { method: 'GET', headers: {} },
    mockResponse(resolve),
  ))
  assert.equal(response.status, 401)
})
