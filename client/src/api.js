const BASE = '/api'

export async function fetchTemplates() {
  const res = await fetch(`${BASE}/templates`)
  if (!res.ok) throw new Error('Failed to fetch templates')
  return res.json()
}

export async function generateProject(body) {
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to generate project')
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
  if (!res.ok) throw new Error('Failed to create repo')
  return res.json()
}
