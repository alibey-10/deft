import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'

/**
 * Admin access without accounts: whoever knows `ADMIN_TOKEN` (a Worker secret) can sign in at
 * /admin/login, which stores a hash of the token in an httpOnly cookie. Rotating the secret signs
 * every admin out.
 */

const COOKIE = 'skilly-admin'
const MAX_AGE = 60 * 60 * 24 * 30

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Compares two hex digests without short-circuiting on the first difference. */
function digestsEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const expectedCookie = async () => {
  const token = process.env.ADMIN_TOKEN
  return token ? sha256(`skilly-admin:${token}`) : undefined
}

/** True when the current request carries a valid admin cookie. */
export async function isAdminRequest() {
  const cookie = getCookie(COOKIE)
  const expected = await expectedCookie()
  return Boolean(cookie && expected && digestsEqual(cookie, expected))
}

/** Signs the request in when `token` matches `ADMIN_TOKEN`. */
export async function signInAdmin(token: string) {
  const expected = await expectedCookie()
  if (!expected || !digestsEqual(await sha256(`skilly-admin:${token}`), expected)) return false
  setCookie(COOKIE, expected, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    maxAge: MAX_AGE,
  })
  return true
}

export function signOutAdmin() {
  deleteCookie(COOKIE, { path: '/' })
}
