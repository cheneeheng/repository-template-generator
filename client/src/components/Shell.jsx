import './Shell.css'
import { Link } from 'react-router-dom'
import { DarkModeToggle } from './DarkModeToggle.jsx'
import { loadWorkspace } from '../lib/workspace.js'

const STEPS = ['Pick', 'Configure', 'Preview', 'Export']

function StepBreadcrumb({ current }) {
  return (
    <>
      <nav className="breadcrumb">
        {STEPS.map((label, i) => {
          const step = i + 1
          const isActive = step === current
          const isLast = step === STEPS.length
          return (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`breadcrumb__step${isActive ? ' breadcrumb__step--active' : ''}`}>
                {label}
              </span>
              {!isLast && <span className="breadcrumb__sep">›</span>}
            </span>
          )
        })}
      </nav>
      <span className="breadcrumb__mobile">Step {current} of {STEPS.length}</span>
    </>
  )
}

export function Shell({ children, step }) {
  const workspaceCount = loadWorkspace().length
  return (
    <div className="shell">
      <header className="shell__nav">
        <span className="shell__logo">Scaffold</span>
        <StepBreadcrumb current={step} />
        <Link to="/workspace" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          Workspace{workspaceCount > 0 ? ` (${workspaceCount})` : ''}
        </Link>
        <DarkModeToggle />
      </header>
      <main className="shell__content">{children}</main>
    </div>
  )
}
