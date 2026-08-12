import test from 'node:test'
import assert from 'node:assert/strict'

import { runSeoWorkflow } from '../api/seo-generate.js'

test('demo mode makes one quota-safe workflow call', async () => {
  const calls = []
  const caller = async (_url, _secret, payload, timeout) => {
    calls.push({ mode: payload.run_mode, timeout })
    return { generation_method: 'workflow' }
  }
  const result = await runSeoWorkflow({ webhookUrl: 'https://example.test', proxySecret: 'secret', payload: { run_mode: 'demo' }, requestedMode: 'demo', caller })
  assert.deepEqual(calls, [{ mode: 'demo', timeout: 20_000 }])
  assert.equal(result.fallbackReason, '')
})

test('live quota failure automatically retries demo mode', async () => {
  const calls = []
  const caller = async (_url, _secret, payload, timeout) => {
    calls.push({ mode: payload.run_mode, timeout })
    if (payload.run_mode === 'live') {
      const error = new Error('quota')
      error.status = 429
      throw error
    }
    return { generation_method: 'workflow' }
  }
  const result = await runSeoWorkflow({ webhookUrl: 'https://example.test', proxySecret: 'secret', payload: { run_mode: 'live' }, requestedMode: 'live', caller })
  assert.deepEqual(calls, [{ mode: 'live', timeout: 55_000 }, { mode: 'demo', timeout: 20_000 }])
  assert.equal(result.fallbackReason, 'Gemini 額度或頻率限制')
})

test('demo failure is surfaced without a retry loop', async () => {
  let calls = 0
  const caller = async () => {
    calls += 1
    throw new Error('offline')
  }
  await assert.rejects(() => runSeoWorkflow({ webhookUrl: 'https://example.test', proxySecret: 'secret', payload: { run_mode: 'demo' }, requestedMode: 'demo', caller }))
  assert.equal(calls, 1)
})
