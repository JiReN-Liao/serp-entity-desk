import test from 'node:test'
import assert from 'node:assert/strict'

import {
  REVIEWER_EMAIL,
  REVIEWER_USERNAME,
  displayAccount,
  resolveLoginEmail,
} from '../src/authIdentifier.js'

test('reviewer username maps to the internal Supabase email', () => {
  assert.equal(resolveLoginEmail(`  ${REVIEWER_USERNAME.toUpperCase()}  `), REVIEWER_EMAIL)
})

test('normal email login remains supported', () => {
  assert.equal(resolveLoginEmail(' User@Example.org '), 'user@example.org')
})

test('reviewer internal email is displayed as a username', () => {
  assert.equal(displayAccount(REVIEWER_EMAIL), REVIEWER_USERNAME)
  assert.equal(displayAccount('user@example.org'), 'user@example.org')
})
