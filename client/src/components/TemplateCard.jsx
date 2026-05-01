import { useState } from 'react'

function FileIcon({ path }) {
  const ext = path.split('.').pop().toLowerCase()
  const icons = {
    js: '⬡', jsx: '⬡', ts: '⬡', tsx: '⬡',
    json: '{}',
    md: '📄',
    yml: '⚙', yaml: '⚙',
    css: '🎨',
    env: '🔑',
    py: '🐍',
    toml: '⚙',
    sh: '⬡',
  }
  const name = path.split('/').pop().toLowerCase()
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) {
    return <span aria-hidden="true">🐳</span>
  }
  return <span aria-hidden="true">{icons[ext] ?? '📄'}</span>
}

export default function TemplateCard({ template, onSelect }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="template-card">
      <div className="template-card__header">
        <h3>{template.label}</h3>
        <p>{template.description}</p>
        <div className="template-card__tags">
          {(template.tags || []).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      </div>

      <div className="template-card__actions">
        {template.files && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls={`files-${template.id}`}
          >
            {expanded ? 'Hide files' : `Show files (${template.files.length})`}
          </button>
        )}
        <button className="btn btn--primary btn--sm" onClick={() => onSelect(template)}>
          Use this template →
        </button>
      </div>

      {expanded && template.files && (
        <ul
          id={`files-${template.id}`}
          className="template-card__file-list"
          aria-label={`Files in ${template.label}`}
        >
          {template.files.map((f) => (
            <li key={f} className="template-card__file-item">
              <FileIcon path={f} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
