import { useAppContext } from '../store/AppContext'

export function StatusBar(): JSX.Element {
  const { state, dispatch } = useAppContext()
  const { session, connectionStatus, connectionInfo, statusMessage, settings, view } = state

  const scoreStr = session
    ? session.event.decimalScoring
      ? session.totalDecimalScore.toFixed(1)
      : String(session.totalScore)
    : null

  const shotStr = session
    ? session.event.shotLimit > 0
      ? `${session.shots.length}/${session.event.shotLimit} shots`
      : `${session.shots.length} shots`
    : null

  return (
    <div className="statusbar">
      <div className="status-dot" style={{ width: 6, height: 6 }} data-status={connectionStatus} />

      {scoreStr && (
        <span style={{ fontWeight: 600, color: 'var(--gold)' }}>{scoreStr}</span>
      )}

      {shotStr && <span>{shotStr}</span>}

      {session?.innerTenCount ? (
        <span style={{ color: 'var(--gold)' }}>{session.innerTenCount}X</span>
      ) : null}

      <span className="statusbar-msg">{statusMessage}</span>

      {settings.shooterName && (
        <span style={{ color: 'var(--text-dimmer)' }}>{settings.shooterName}</span>
      )}

      {view !== 'shooting' ? (
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={() => dispatch({ type: 'BACK_TO_SHOOTING' })}
        >
          ← Back
        </button>
      ) : (
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={() => dispatch({ type: 'SHOW_HISTORY' })}
        >
          History
        </button>
      )}
    </div>
  )
}
