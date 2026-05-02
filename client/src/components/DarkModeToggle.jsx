import { useState, useEffect } from 'react'

const STORAGE_KEY = 'color-scheme'

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
}

export function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      setDark(e.matches)
      applyTheme(e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    applyTheme(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="dark-mode-toggle"
    >
      {dark ? '☀︎' : '☾'}
    </button>
  )
}
