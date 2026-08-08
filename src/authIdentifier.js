export const REVIEWER_USERNAME = 'reviewer'
export const REVIEWER_EMAIL = 'reviewer@example.com'

export function resolveLoginEmail(value) {
  const identifier = String(value || '').trim().toLowerCase()
  return identifier === REVIEWER_USERNAME ? REVIEWER_EMAIL : identifier
}

export function displayAccount(email) {
  return String(email || '').toLowerCase() === REVIEWER_EMAIL
    ? REVIEWER_USERNAME
    : email
}
