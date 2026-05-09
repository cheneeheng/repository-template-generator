import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadWorkspace, deleteEntry } from '../lib/workspace.js'
import { relativeTime } from '../lib/relativeTime.js'

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState(() => loadWorkspace())

  function handleOpen(entry) {
    navigate('/preview', {
      state: {
        fileTree: entry.fileTree,
        snapshots: entry.snapshots,
        projectName: entry.projectName,
        templateId: entry.templateId,
        workspaceId: entry.id,
        fromWorkspace: true,
      },
    })
  }

  function handleDelete(id) {
    deleteEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div>
      <h1>Your projects</h1>
      {entries.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No saved projects yet. Generate one to get started.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(entry => (
            <li
              key={entry.id}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '1rem',
                background: 'var(--color-bg-surface)',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{entry.projectName}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                {entry.templateId} &middot; {entry.fileTree.length} file{entry.fileTree.length !== 1 ? 's' : ''}
                {' '}· Saved {relativeTime(entry.savedAt)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleOpen(entry)} style={{ padding: '0.375rem 1rem' }}>
                  Open
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  style={{ padding: '0.375rem 1rem', background: 'transparent', color: 'var(--color-error)' }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
