import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import { exportZip, exportRepo } from '../api.js'
import { ErrorToast } from '../components/ErrorToast.jsx'
import './ExportPage.css'

function DownloadZipButton({ fileTree, onError }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await exportZip(fileTree)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'project.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      onError(err.message ?? 'Failed to export ZIP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} style={{ padding: '0.5rem 1.5rem' }}>
      {loading ? 'Preparing...' : 'Download ZIP'}
    </button>
  )
}

function RepoCreationForm({ fileTree, projectConfig, onError }) {
  const [token, setToken] = useState('')
  const [owner, setOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [loading, setLoading] = useState(false)
  const [repoUrl, setRepoUrl] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await exportRepo({
        fileTree,
        provider: projectConfig?.provider,
        token,
        owner,
        repoName,
        description: projectConfig?.description,
      })
      setRepoUrl(result.repoUrl)
    } catch (err) {
      onError(err.message ?? 'Failed to create repository')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', maxWidth: '480px' }}>
      <h2>Create Repository</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem' }}>
          {projectConfig?.provider === 'gitlab' ? 'GitLab' : 'GitHub'} Token
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem' }}>
          {projectConfig?.provider === 'gitlab' ? 'Namespace' : 'Org / User'}
        </label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem' }}>Repository Name</label>
        <input
          type="text"
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
        />
      </div>
      <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.5rem' }}>
        {loading ? 'Creating...' : 'Create Repository'}
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
  const navigate = useNavigate()
  const fileTree = useStore((s) => s.fileTree)
  const projectConfig = useStore((s) => s.projectConfig)
  const [error, setError] = useState(null)
  const [showRepoForm, setShowRepoForm] = useState(false)

  useEffect(() => {
    if (!fileTree) navigate('/')
  }, [fileTree, navigate])

  if (!fileTree) return null

  const isZipOnly = projectConfig?.provider === 'zip'

  return (
    <div>
      <h1>Export</h1>
      <div className="export-actions">
        <DownloadZipButton fileTree={fileTree} onError={setError} />
        {!isZipOnly && (
          <button
            onClick={() => setShowRepoForm((v) => !v)}
            style={{ padding: '0.5rem 1.5rem' }}
          >
            {showRepoForm ? 'Hide Repo Form' : 'Create Repository'}
          </button>
        )}
      </div>
      {!isZipOnly && showRepoForm && (
        <RepoCreationForm fileTree={fileTree} projectConfig={projectConfig} onError={setError} />
      )}
      <ErrorToast message={error} onDismiss={() => setError(null)} />
    </div>
  )
}
