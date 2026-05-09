import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import { fetchAuthProviders } from '../api.js'

export default function ConfigurePage() {
  const navigate = useNavigate()
  const selectedTemplate = useStore((s) => s.selectedTemplate)
  const setProjectConfig = useStore((s) => s.setProjectConfig)

  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState('zip')
  const [submitting, setSubmitting] = useState(false)
  const [availableProviders, setAvailableProviders] = useState(null) // null = loading

  useEffect(() => {
    if (!selectedTemplate) navigate('/')
  }, [selectedTemplate, navigate])

  useEffect(() => {
    fetchAuthProviders()
      .then((p) => {
        setAvailableProviders(p)
        // Default to first configured provider, fallback to zip
        if (p.github) setProvider('github')
        else if (p.gitlab) setProvider('gitlab')
        else setProvider('zip')
      })
      .catch(() => {
        setAvailableProviders({ github: false, gitlab: false })
        setProvider('zip')
      })
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setProjectConfig({ projectName, description, provider })
    navigate('/preview')
  }

  if (!selectedTemplate) return null

  const hasProviders = availableProviders && (availableProviders.github || availableProviders.gitlab)

  const providerOptions = [
    ...(availableProviders?.github ? [{ value: 'github', label: 'GitHub' }] : []),
    ...(availableProviders?.gitlab ? [{ value: 'gitlab', label: 'GitLab' }] : []),
    { value: 'zip', label: 'ZIP only' },
  ]

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1>Configure Project</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>Template: {selectedTemplate.label}</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="project-name" style={{ display: 'block', marginBottom: '0.25rem' }}>Project Name</label>
          <input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--color-bg-input)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="description" style={{ display: 'block', marginBottom: '0.25rem' }}>Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--color-bg-input)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
          />
        </div>
        {hasProviders && availableProviders && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Provider</label>
            {providerOptions.map((p) => (
              <label key={p.value} style={{ marginRight: '1rem' }}>
                <input
                  type="radio"
                  name="provider"
                  value={p.value}
                  checked={provider === p.value}
                  onChange={() => setProvider(p.value)}
                  style={{ marginRight: '0.25rem' }}
                />
                {p.label}
              </label>
            ))}
          </div>
        )}
        <button type="submit" disabled={submitting || availableProviders === null} style={{ padding: '0.5rem 1.5rem' }}>
          {submitting ? 'Starting...' : 'Generate'}
        </button>
      </form>
    </div>
  )
}
