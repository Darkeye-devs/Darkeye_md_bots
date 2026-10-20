/** Thin fetch wrapper with timeout, retries and JSON parsing. */

export async function fetchJson(url, { method = 'GET', headers = {}, body, timeout = 15_000, retries = 1 } = {}) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, {
        method,
        headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal
      })
      const text = await res.text()
      if (!res.ok) {
        const error = new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`)
        error.status = res.status
        throw error
      }
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}
