import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import { fetchTemplates } from '../api.js'
import TemplateGrid from '../components/TemplateGrid.jsx'

const FALLBACK = [
  {
    id: 'react-express-postgres',
    label: 'React + Express + PostgreSQL',
    description: 'Full-stack app with React frontend, Express API, and PostgreSQL database.',
    tags: ['react', 'express', 'postgres', 'docker', 'gh-actions'],
  },
]

export default function TemplatePickerPage() {
  const [templates, setTemplates] = useState({ templates: [] })
  const setSelectedTemplate = useStore((s) => s.setSelectedTemplate)
  const navigate = useNavigate()

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch(() => setTemplates({ templates: FALLBACK }))
  }, [])

  function handleSelect(template) {
    setSelectedTemplate(template)
    navigate('/configure')
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Choose a Template</h1>
      <TemplateGrid templates={templates.templates} onSelect={handleSelect} />
    </div>
  )
}
