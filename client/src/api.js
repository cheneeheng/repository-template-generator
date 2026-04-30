const BASE = '/api'

export async function fetchTemplates() {
  const res = await fetch(`${BASE}/templates`)
  if (!res.ok) throw new Error('Failed to fetch templates')
  return res.json()
}

export async function fetchAuthProviders() {
  const res = await fetch(`${BASE}/auth/providers`)
  if (!res.ok) return { github: false, gitlab: false }
  return res.json()
}

export async function exportZip(fileTree) {
  const res = await fetch(`${BASE}/export/zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileTree }),
  })
  if (!res.ok) throw new Error('Failed to export zip')
  return res
}

export async function exportRepo(body) {
  const res = await fetch(`${BASE}/export/repo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    const err = new Error('Session expired — reconnect to continue')
    err.status = 401
    throw err
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to create repo')
  }
  return res.json()
}
