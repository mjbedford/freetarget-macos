import { useAppContext } from '../store/AppContext'

const TYPE_LABELS: Record<string, string> = {
  practice: 'Practice',
  match: 'Match',
  final: 'Final'
}

export function EventSelector(): JSX.Element {
  const { state, dispatch } = useAppContext()
  const { events, selectedEvent, session } = state

  const sessionActive = session?.status === 'active'

  return (
    <div className="panel">
      <div className="panel-title">Course of Fire</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {events.map(ev => (
          <button
            key={ev.id}
            onClick={() => {
              if (!sessionActive) dispatch({ type: 'SELECT_EVENT', event: ev })
            }}
            disabled={sessionActive}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: selectedEvent?.id === ev.id ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: selectedEvent?.id === ev.id ? 'rgba(10,132,255,0.12)' : 'var(--surface2)',
              color: 'var(--text)',
              cursor: sessionActive ? 'not-allowed' : 'pointer',
              fontSize: 12,
              textAlign: 'left',
              opacity: sessionActive ? 0.6 : 1,
              WebkitAppRegion: 'no-drag' as never
            }}
          >
            <span>{ev.name}</span>
            <span className={`event-badge badge-${ev.type}`}>{TYPE_LABELS[ev.type]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
