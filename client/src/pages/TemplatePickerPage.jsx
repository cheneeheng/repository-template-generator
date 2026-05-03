import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import { fetchTemplates } from '../api.js'
import TemplateGrid from '../components/TemplateGrid.jsx'
import { SkeletonBlock } from '../components/SkeletonBlock.jsx'
import { ErrorToast } from '../components/ErrorToast.jsx'
import { useAppConfig } from '../context/AppConfigContext.jsx'

const FALLBACK = [
  {
    id: 'react-express-postgres',
    label: 'React + Express + PostgreSQL',
    description: 'Full-stack app with React frontend, Express API, and PostgreSQL database.',
    tags: ['react', 'express', 'postgres', 'docker', 'gh-actions'],
    files: [],
  },
]

function SkeletonCard() {
  return (
    <div className="template-card template-card--skeleton">
      <SkeletonBlock height="1.25rem" width="60%" />
      <SkeletonBlock height="0.875rem" width="90%" style={{ marginTop: '0.5rem' }} />
      <SkeletonBlock height="0.875rem" width="75%" style={{ marginTop: '0.25rem' }} />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <SkeletonBlock height="1.25rem" width="3rem" />
        <SkeletonBlock height="1.25rem" width="3rem" />
        <SkeletonBlock height="1.25rem" width="3rem" />
      </div>
    </div>
  )
}

export default function TemplatePickerPage() {
  const [templates, setTemplates] = useState(null)
  const [error, setError] = useState(null)
  const setSelectedTemplate = useStore((s) => s.setSelectedTemplate)
  const navigate = useNavigate()
  const { llmEnabled } = useAppConfig()

  useEffect(() => {
    fetchTemplates()
      .then((data) => setTemplates(data.templates ?? data))
      .catch(() => {
        setError('Failed to load templates — showing defaults')
        setTemplates(FALLBACK)
      })
  }, [])

  function handleSelect(template) {
    setSelectedTemplate(template)
    navigate('/configure')
  }

  return (
    <div>
      <h1>Choose a Template</h1>
      {!llmEnabled && (
        <div className="banner banner--warning" role="status">
          <strong>LLM unavailable</strong> — templates will be returned without customisation.
          Placeholder values like <code>{'{{PROJECT_NAME}}'}</code> will not be replaced.
          To enable full customisation, set <code>ANTHROPIC_API_KEY</code> on the server.
        </div>
      )}
      {templates === null ? (
        <div className="template-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <TemplateGrid templates={templates} onSelect={handleSelect} />
      )}
      <ErrorToast message={error} onDismiss={() => setError(null)} />
    </div>
  )
}
