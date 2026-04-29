export default function TemplateCard({ template, onSelect }) {
  return (
    <div
      onClick={() => onSelect(template)}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <h3 style={{ margin: '0 0 0.5rem' }}>{template.label}</h3>
      <p style={{ margin: '0 0 0.75rem', color: '#555', fontSize: '0.9rem' }}>{template.description}</p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {(template.tags || []).map((tag) => (
          <span
            key={tag}
            style={{
              background: '#e8f0fe',
              color: '#1a56db',
              borderRadius: '999px',
              padding: '0.15rem 0.6rem',
              fontSize: '0.75rem',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
