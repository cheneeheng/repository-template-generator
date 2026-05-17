import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import useStore from '../store.js'
import { exportRepo } from '../api.js'
import { ErrorToast } from '../components/ErrorToast.jsx'
import './ExportPage.css'

function providerLabel(p) {
  if (p === 'gitlab') return 'GitLab'
  if (p === 'github-app') return 'GitHub App'
  return 'GitHub'
}

function DownloadZipButton({ fileTree, projectName, onError }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/export/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileTree, projectName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'ZIP export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName ?? 'project'}.zip`
      a.click()
      /* v8 ignore next */
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (err) {
      onError(err.message ?? 'Failed to export ZIP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} style={{ padding: '0.5rem 1.5rem' }}>
      {loading ? <span className="spinner" aria-label="Loading" /> : 'Download ZIP'}
    </button>
  )
}

function ConnectButton({ provider, token, onDisconnect }) {
  const label = provider === 'gitlab' ? 'GitLab' : 'GitHub'

  if (token) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>Connected as {label} ✓</span>
        <button
          onClick={onDisconnect}
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
        >
          Disconnect
        </button>
      </span>
    )
  }

  return (
    <a href={`/api/auth/${provider}/start`} style={{ textDecoration: 'none' }}>
      <button style={{ padding: '0.5rem 1.5rem' }}>Connect {label}</button>
    </a>
  )
}

function RepoCreationForm({ projectConfig, onSubmit, repoUrl }) {
  const [owner, setOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const provider = projectConfig?.provider

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({ owner, repoName, isPrivate })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', maxWidth: '480px' }}>
      <h2>Create Repository</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="repo-owner" style={{ display: 'block', marginBottom: '0.25rem' }}>
          {provider === 'gitlab' ? 'Namespace' : 'Org / User'}
        </label>
        <input
          id="repo-owner"
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--color-bg-input)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="repo-name" style={{ display: 'block', marginBottom: '0.25rem' }}>Repository Name</label>
        <input
          id="repo-name"
          type="text"
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--color-bg-input)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          Private repository
        </label>
      </div>
      <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.5rem' }}>
        {loading ? <span className="spinner" aria-label="Loading" /> : 'Create Repository'}
      </button>
      {repoUrl && (
        <p style={{ marginTop: '1rem' }}>
          Repository created:{' '}
          <a href={repoUrl} target="_blank" rel="noreferrer">
            {repoUrl}
          </a>
        </p>
      )}
    </form>
  )
}

export default function ExportPage() {
  const fileTree = useStore((s) => s.fileTree)
  const projectConfig = useStore((s) => s.projectConfig)
  const [error, setError] = useState(null)
  const [showRepoForm, setShowRepoForm] = useState(false)
  const [repoUrl, setRepoUrl] = useState(null)
  const [providers, setProviders] = useState({ github: false, githubApp: false, gitlab: false })
  // authState values are objects { token, refreshToken?, expiresAt? } or null
  const [authState, setAuthState] = useState({ github: null, gitlab: null, 'github-app': null })

  useEffect(() => {
    fetch('/api/auth/providers')
      .then(r => r.json())
      .then(data => setProviders(data))
      .catch(() => {})
  }, [])

  // Read token or error from URL fragment placed there by the OAuth/App callback redirect
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const errorMsg = hash.get('error')
    const token = hash.get('token')
    const provider = hash.get('provider')

    if (errorMsg) {
      setError(errorMsg)
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    if (token && provider) {
      const entry = { token }
      if (provider === 'gitlab') {
        entry.refreshToken = hash.get('refreshToken')
        entry.expiresAt = Number(hash.get('expiresAt'))
      }
      setAuthState((prev) => ({ ...prev, [provider]: entry }))
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  if (!fileTree) return <Navigate to="/" replace />

  const provider = projectConfig?.provider
  const isZipOnly = !provider || provider === 'zip'
  // Prefer github-app over github if both are connected
  const activeProvider = !isZipOnly && authState['github-app']?.token ? 'github-app' : provider
  const tokenEntry = isZipOnly ? null : authState[provider]
  const token = tokenEntry?.token ?? null
  const isConnected = !!token || !!authState['github-app']?.token

  function handleDisconnect() {
    /* v8 ignore next */
    if (!tokenEntry) return
    // Best-effort revocation — ignore errors
    fetch(`/api/auth/${provider}/revoke?token=${encodeURIComponent(tokenEntry.token)}`).catch(() => {})
    setAuthState((prev) => ({ ...prev, [provider]: null }))
    setShowRepoForm(false)
  }

  async function handleRepoCreate({ owner, repoName, isPrivate }) {
    const auth = authState[activeProvider]
    try {
      const result = await exportRepo({
        fileTree,
        provider: activeProvider,
        token: auth?.token,
        owner,
        repoName,
        description: projectConfig?.description,
        isPrivate,
      })
      setRepoUrl(result.repoUrl)
    } catch (err) {
      if (err.status === 401 && activeProvider === 'gitlab' && auth?.refreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/gitlab/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: auth.refreshToken }),
          })
          if (refreshRes.ok) {
            const newTokens = await refreshRes.json()
            const newAuth = {
              token: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              expiresAt: newTokens.expiresAt,
            }
            setAuthState((prev) => ({ ...prev, gitlab: newAuth }))
            try {
              const retryResult = await exportRepo({
                fileTree,
                provider: activeProvider,
                token: newAuth.token,
                owner,
                repoName,
                description: projectConfig?.description,
                isPrivate,
              })
              setRepoUrl(retryResult.repoUrl)
            } catch (retryErr) {
              setError(retryErr.message ?? 'Repo creation failed after token refresh')
            }
            return
          }
        } catch {}
        // refresh failed — fall through to re-auth
      }
      if (err.status === 401) {
        setAuthState((prev) => ({ ...prev, [activeProvider]: null }))
        setError(`Session expired — reconnect ${providerLabel(activeProvider)} to continue`)
        return
      }
      setError(err.message ?? 'Failed to create repository')
    }
  }

  return (
    <div>
      <h1>Export</h1>
      <div className="export-actions">
        <DownloadZipButton fileTree={fileTree} projectName={projectConfig?.projectName} onError={setError} />
        {!isZipOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <ConnectButton provider={provider} token={token} onDisconnect={handleDisconnect} />
            {providers.githubApp && provider === 'github' && !authState['github-app'] && (
              <a href="/api/auth/github-app/install" style={{ textDecoration: 'none' }}>
                <button style={{ padding: '0.5rem 1.5rem' }}>Connect via GitHub App</button>
              </a>
            )}
            {authState['github-app'] && (
              <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>GitHub App connected ✓</span>
            )}
            {isConnected && (
              <button
                onClick={() => setShowRepoForm((v) => !v)}
                style={{ padding: '0.5rem 1.5rem' }}
              >
                {showRepoForm ? 'Hide Repo Form' : 'Create Repository'}
              </button>
            )}
          </div>
        )}
      </div>
      {!isZipOnly && showRepoForm && isConnected && (
        <RepoCreationForm
          projectConfig={projectConfig}
          onSubmit={handleRepoCreate}
          repoUrl={repoUrl}
        />
      )}
      <ErrorToast message={error} onDismiss={() => setError(null)} />
    </div>
  )
}
