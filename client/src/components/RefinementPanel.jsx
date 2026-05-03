import { useState } from 'react'

export function RefinementPanel({ onSubmit, disabled, disabledReason }) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim() || disabled) return
    onSubmit(value.trim())
    setValue('')
  }

  return (
    <div className="refinement-panel">
      <p className="refinement-panel__label">Refine your project</p>
      {disabledReason ? (
        <p className="refinement-panel__disabled-reason">{disabledReason}</p>
      ) : (
        <div className="refinement-panel__row">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e) }}
            placeholder="e.g. make it TypeScript, add a .prettierrc"
            disabled={disabled}
            aria-label="Refinement instruction"
            maxLength={1000}
            className="refinement-panel__input"
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className="refinement-panel__btn"
          >
            {disabled ? <span className="spinner" aria-label="Loading" /> : 'Refine'}
          </button>
        </div>
      )}
    </div>
  )
}
