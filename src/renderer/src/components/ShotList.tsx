import { useRef, useEffect } from 'react'
import { useAppContext } from '../store/AppContext'
import { Shot, Series } from '../domain/types'

function formatDuration(ms?: number): string {
  if (ms == null) return '—'
  const s = ms / 1000
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${String(Math.floor(s % 60)).padStart(2, '0')}s`
}

interface ShotRowProps {
  shot: Shot
  isLatest: boolean
  decimalScoring: boolean
}

function ShotRow({ shot, isLatest, decimalScoring }: ShotRowProps): JSX.Element {
  const scoreStr = shot.miss
    ? 'Miss'
    : decimalScoring
    ? shot.decimalScore.toFixed(1)
    : String(shot.score)

  return (
    <tr className={`${isLatest ? 'latest' : ''} ${shot.innerTen ? 'inner-ten' : ''} ${shot.miss ? 'miss' : ''}`}>
      <td>{shot.index + 1}</td>
      <td className="score-cell">
        {scoreStr}
        {shot.innerTen && <span style={{ color: 'var(--gold)', marginLeft: 2 }}>X</span>}
      </td>
      <td style={{ color: 'var(--text-dim)' }}>{formatDuration(shot.durationMs)}</td>
      <td style={{ color: 'var(--text-dimmer)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
        {shot.miss ? '—' : `${shot.adjustedX.toFixed(1)},${shot.adjustedY.toFixed(1)}`}
      </td>
    </tr>
  )
}

interface SeriesBlockProps {
  series: Series
  seriesIdx: number
  totalShots: number
  decimalScoring: boolean
}

function SeriesBlock({ series, seriesIdx, totalShots, decimalScoring }: SeriesBlockProps): JSX.Element {
  const seriesScore = series.shots
    .filter(s => !s.miss)
    .reduce((sum, s) => sum + (decimalScoring ? s.decimalScore : s.score), 0)

  const scoreStr = decimalScoring ? seriesScore.toFixed(1) : String(seriesScore)

  return (
    <>
      <tr className="series-header">
        <td colSpan={4}>
          Series {seriesIdx + 1} — {scoreStr}
        </td>
      </tr>
      {series.shots.map(shot => (
        <ShotRow
          key={shot.index}
          shot={shot}
          isLatest={shot.index === totalShots - 1}
          decimalScoring={decimalScoring}
        />
      ))}
    </>
  )
}

export function ShotList(): JSX.Element {
  const { state, dispatch } = useAppContext()
  const { session } = state
  const tableRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest shot
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollTop = tableRef.current.scrollHeight
    }
  }, [session?.shots.length])

  if (!session) {
    return (
      <div className="panel" style={{ flex: 1 }}>
        <div className="panel-title">Shots</div>
        <div style={{ color: 'var(--text-dimmer)', fontSize: 12, padding: '8px 0' }}>
          No active session
        </div>
        <button
          className="btn btn-full"
          style={{ marginTop: 'auto' }}
          onClick={() => dispatch({ type: 'SHOW_HISTORY' })}
        >
          View History
        </button>
      </div>
    )
  }

  const { shots, series, event } = session
  const decimalScoring = event.decimalScoring

  // Summary stats
  const avg =
    shots.length > 0
      ? (shots.reduce((s, sh) => s + sh.decimalScore, 0) / shots.length).toFixed(2)
      : '—'
  const innerX = session.innerTenCount

  return (
    <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="panel-title" style={{ margin: 0 }}>Shots</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          avg {avg}{innerX > 0 ? ` · ${innerX}X` : ''}
        </div>
      </div>

      <div ref={tableRef} style={{ flex: 1, overflowY: 'auto' }}>
        <table className="shot-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Score</th>
              <th>Time</th>
              <th>x,y</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s, i) => (
              <SeriesBlock
                key={i}
                series={s}
                seriesIdx={i}
                totalShots={shots.length}
                decimalScoring={decimalScoring}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <button
          className="btn btn-full"
          onClick={() => dispatch({ type: 'SHOW_HISTORY' })}
        >
          View History
        </button>
      </div>
    </div>
  )
}
