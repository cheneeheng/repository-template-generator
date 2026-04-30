import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import { fetchTemplates } from '../api.js'
import TemplateGrid from '../components/TemplateGrid.jsx'
import { ErrorToast } from '../components/ErrorToast.jsx'

const FALLBACK = [
  {
    id: 'react-express-postgres',
    label: 'React + Express + PostgreSQL',
    description: 'Full-stack app with React frontend, Express API, and PostgreSQL database.',
    tags: ['react', 'express', 'postgres', 'docker', 'gh-actions'],
  },
]

export default function TemplatePickerPage() {
  const [templates, setTemplates] = useState(null)
  const [error, setError] = useState(null)
  const setSelectedTemplate = useStore((s) => s.setSelectedTemplate)
  const navigate = useNavigate()

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
      {templates === null ? (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: '220px',
                height: '120px',
                background: '#eee',
                borderRadius: '6px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      ) : (
        <TemplateGrid templates={templates} onSelect={handleSelect} />
      )}
      <ErrorToast message={error} onDismiss={() => setError(null)} />
    </div>
  )
}
