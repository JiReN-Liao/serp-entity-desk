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
  assert.deepEqual(calls, [{ mode: 'demo', timeout: 5_000 }])
  assert.equal(result.fallbackReason, '')
  assert.equal(result.executionPath, 'n8n')
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
  assert.deepEqual(calls, [{ mode: 'live', timeout: 55_000 }, { mode: 'demo', timeout: 5_000 }])
  assert.equal(result.fallbackReason, 'Gemini 額度或頻率限制')
  assert.equal(result.executionPath, 'n8n')
})

test('demo tunnel failure uses the local emergency composer', async () => {
  let calls = 0
  const caller = async () => {
    calls += 1
    throw new Error('offline')
  }
  const emergency = () => ({ generation_method: 'vercel-emergency-composer' })
  const result = await runSeoWorkflow({ webhookUrl: 'https://example.test', proxySecret: 'secret', payload: { run_mode: 'demo' }, requestedMode: 'demo', caller, emergency })
  assert.equal(calls, 1)
  assert.equal(result.executionPath, 'vercel-emergency')
  assert.equal(result.fallbackReason, 'n8n Tunnel 暫時離線')
})
