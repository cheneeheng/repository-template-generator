import { useEffect } from 'react'

export function ErrorToast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [message, onDismiss])

  if (!message) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        background: 'var(--color-error)',
        color: '#fff',
        padding: '0.75rem 1rem',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        zIndex: 1000,
        maxWidth: '400px',
      }}
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: 0,
          lineHeight: 1,
        }}
      >
        x
      </button>
    </div>
  )
}
