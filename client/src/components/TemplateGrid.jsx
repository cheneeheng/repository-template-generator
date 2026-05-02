import { useState } from 'react'
import TemplateCard from './TemplateCard.jsx'
import './TemplateGrid.css'

export default function TemplateGrid({ templates, onSelect }) {
  const [activeTag, setActiveTag] = useState(null)

  const allTags = [...new Set(templates.flatMap((t) => t.tags || []))]
  const visible = activeTag ? templates.filter((t) => t.tags?.includes(activeTag)) : templates

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`tag-filter${activeTag === tag ? ' tag-filter--active' : ''}`}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="template-grid">
        {visible.map((t) => (
          <TemplateCard key={t.id} template={t} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}
