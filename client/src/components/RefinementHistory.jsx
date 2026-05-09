import { relativeTime } from '../lib/relativeTime.js';

export function RefinementHistory({ snapshots, activeSnapshot, onRevert }) {
  if (snapshots.length < 2) return null;

  return (
    <div className="refinement-history" aria-label="Refinement history">
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
        History
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {snapshots.map((snap, i) => {
          const isActive = i === activeSnapshot;
          const isLatest = i === snapshots.length - 1;
          const label = isLatest && isActive ? `${snap.label} (Current)` : snap.label;
          return (
            <li key={snap.id}>
              <button
                onClick={() => onRevert(i)}
                aria-pressed={isActive}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.4rem 0.75rem',
                  marginBottom: '0.25rem',
                  background: isActive ? 'var(--color-accent)' : 'var(--color-bg-surface)',
                  color: isActive ? 'var(--color-bg)' : 'var(--color-text)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                }}
              >
                <span>{label}</span>
                <span style={{ opacity: 0.7, fontSize: '0.8em' }}>{relativeTime(snap.timestamp)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
