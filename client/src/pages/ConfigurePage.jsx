import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import { generateProject } from '../api.js'

export default function ConfigurePage() {
  const navigate = useNavigate()
  const selectedTemplate = useStore((s) => s.selectedTemplate)
  const setProjectConfig = useStore((s) => s.setProjectConfig)
  const setFileTree = useStore((s) => s.setFileTree)

  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState('github')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!selectedTemplate) navigate('/')
  }, [selectedTemplate, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const config = { projectName, description, provider }
    setProjectConfig(config)
    try {
      const fileTree = await generateProject({
        templateId: selectedTemplate.id,
        projectName,
        description,
      })
      setFileTree(fileTree)
      navigate('/preview')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!selectedTemplate) return null

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h1>Configure Project</h1>
      <p style={{ color: '#666' }}>Template: {selectedTemplate.label}</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Project Name</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Provider</label>
          {['github', 'gitlab', 'zip'].map((p) => (
            <label key={p} style={{ marginRight: '1rem' }}>
              <input
                type="radio"
                name="provider"
                value={p}
                checked={provider === p}
                onChange={() => setProvider(p)}
                style={{ marginRight: '0.25rem' }}
              />
              {p === 'zip' ? 'ZIP only' : p.charAt(0).toUpperCase() + p.slice(1)}
            </label>
          ))}
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.5rem' }}>
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </form>
    </div>
  )
}
