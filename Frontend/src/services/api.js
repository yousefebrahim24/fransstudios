// Thin fetch wrapper for the same-origin ASP.NET Core API.
// - Auth is an HttpOnly cookie the browser sends automatically; nothing sensitive is stored in JS.
// - Unsafe requests echo the XSRF-TOKEN cookie in the X-XSRF-TOKEN header (CSRF protection).
// - Errors arrive as RFC 7807 ProblemDetails and are thrown as ApiError.

export class ApiError extends Error {
  constructor(status, problem) {
    super(problem?.title || `Request failed (${status})`)
    this.status = status
    this.problem = problem
    /** Field errors from ValidationProblemDetails: { fieldName: [messages] } (keys camelCased). */
    this.fieldErrors = normaliseErrors(problem?.errors)
  }
}

function normaliseErrors(errors) {
  if (!errors) return {}
  const out = {}
  for (const [key, messages] of Object.entries(errors)) {
    const field = key.replace(/^\$\./, '').replace(/^[A-Z]/, (c) => c.toLowerCase())
    out[field] = messages
  }
  return out
}

function readCookie(name) {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

let csrfRequest = null
export function ensureCsrf() {
  if (readCookie('XSRF-TOKEN')) return Promise.resolve()
  csrfRequest ??= fetch('/api/auth/csrf', { credentials: 'same-origin' }).finally(() => {
    csrfRequest = null
  })
  return csrfRequest
}

const listeners = new Set()
/** Called with no arguments whenever the API says the session is gone (401). */
export function onUnauthorized(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * @param {string} path  e.g. "/api/client/albums"
 * @param {{method?: string, body?: any, form?: FormData, signal?: AbortSignal, query?: Record<string, any>}} [options]
 */
export async function api(path, { method = 'GET', body, form, signal, query } = {}) {
  const url = query ? `${path}?${toQuery(query)}` : path
  const headers = { Accept: 'application/json' }
  const unsafe = method !== 'GET' && method !== 'HEAD'

  if (unsafe) {
    await ensureCsrf()
    headers['X-XSRF-TOKEN'] = readCookie('XSRF-TOKEN') ?? ''
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    credentials: 'same-origin',
    signal,
  })

  if (response.status === 401 && !path.startsWith('/api/auth/')) listeners.forEach((fn) => fn())

  if (!response.ok) {
    let problem = null
    try {
      problem = await response.json()
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, problem)
  }

  if (response.status === 204 || response.status === 202) return null
  const type = response.headers.get('Content-Type') ?? ''
  return type.includes('json') ? response.json() : response.text()
}

export function toQuery(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  return search.toString()
}

/**
 * Upload with progress (fetch can't report upload progress). Returns parsed JSON.
 * @param {(fraction: number) => void} [onProgress]
 */
export async function upload(path, form, onProgress) {
  await ensureCsrf()
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', path)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-XSRF-TOKEN', readCookie('XSRF-TOKEN') ?? '')
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      let data = null
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new ApiError(xhr.status, data))
    }
    xhr.onerror = () => reject(new ApiError(0, { title: 'Network error. Check your connection and try again.' }))
    xhr.send(form)
  })
}
