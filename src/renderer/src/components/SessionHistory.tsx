import React, { useEffect, useState } from 'react'
import { useAppContext } from '../store/AppContext'
import { SessionSummary, Session, Shot, Series } from '../domain/types'
import { getTargetByName } from '../domain/targets'
import { groupIntoSeries } from '../domain/scoring'
import { TargetCanvas } from './TargetCanvas'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function rowToShot(row: Record<string, unknown>, index: number): Shot {
  return {
    sessionId: Number(row.session_id),
    index: Number(row.shot_index ?? index),
    miss: Boolean(row.miss),
    rawX: Number(row.raw_x ?? 0),
    rawY: Number(row.raw_y ?? 0),
    calibration: {
      xOffset: Number(row.calibration_x ?? 0),
      yOffset: Number(row.calibration_y ?? 0),
      angle: Number(row.calibration_angle ?? 0)
    },
    score: Number(row.score ?? 0),
    decimalScore: Number(row.decimal_score ?? 0),
    innerTen: Boolean(row.inner_ten),
    timestamp: String(row.timestamp ?? ''),
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : undefined,
    adjustedX: Number(row.adjusted_x ?? 0),
    adjustedY: Number(row.adjusted_y ?? 0),
    radius: Number(row.radius ?? 0)
  }
}

function DetailView({ sessionId }: { sessionId: number }): JSX.Element {
  const { dispatch } = useAppContext()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    window.api.getSession(sessionId).then((raw: unknown) => {
      const { session: sRow, shots: shotRows } = raw as {
        session: Record<string, unknown>
        shots: Record<string, unknown>[]
      }

      const caliber = Number(sRow.caliber ?? 4.5)
      const targetName = String(sRow.target_name ?? 'AirRifle')
      const target = getTargetByName(targetName, caliber)

      const event = {
        id: Number(sRow.event_id),
        name: String(sRow.event_name ?? sRow.name ?? ''),
        type: String(sRow.type ?? 'practice') as Session['event']['type'],
        target,
        decimalScoring: Boolean(sRow.decimal_scoring),
        shotLimit: Number(sRow.shot_limit ?? -1),
        durationMinutes: Number(sRow.duration_minutes ?? -1),
        caliber,
        rapidFire: Boolean(sRow.rapid_fire)
      }

      const shots = shotRows.map((r, i) => rowToShot(r, i))
      const series = groupIntoSeries(shots, event)

      const s: Session = {
        id: Number(sRow.id),
        shooter: String(sRow.shooter ?? ''),
        event,
        status: 'saved',
        calibration: {
          xOffset: Number(sRow.calibration_x ?? 0),
          yOffset: Number(sRow.calibration_y ?? 0),
          angle: Number(sRow.calibration_angle ?? 0)
        },
        startTime: String(sRow.start_time ?? ''),
        endTime: sRow.end_time ? String(sRow.end_time) : undefined,
        shots,
        series,
        totalScore: Number(sRow.total_score ?? 0),
        totalDecimalScore: Number(sRow.total_decimal_score ?? 0),
        innerTenCount: Number(sRow.inner_ten_count ?? 0),
        stats: {
          shotCount: Number(sRow.shot_count ?? shots.length),
          averageScore: Number(sRow.average_score ?? 0),
          averageShotDurationMs: Number(sRow.average_shot_duration_ms ?? 0),
          shortestShotDurationMs: Number(sRow.shortest_shot_duration_ms ?? 0),
          longestShotDurationMs: Number(sRow.longest_shot_duration_ms ?? 0),
          windage: Number(sRow.windage ?? 0),
          elevation: Number(sRow.elevation ?? 0),
          meanRadius: Number(sRow.mean_radius ?? 0),
          groupSize: Number(sRow.group_size ?? 0)
        }
      }

      setSession(s)
      dispatch({ type: 'SHOW_DETAIL', session: s })
    })
  }, [sessionId])

  if (!session) return <div style={{ padding: 20, color: 'var(--text-dim)' }}>Loading…</div>

  const { stats, event } = session
  const scoreStr = event.decimalScoring
    ? session.totalDecimalScore.toFixed(1)
    : String(session.totalScore)

  return (
    <div className="detail-view">
      <div className="history-header">
        <button className="btn" onClick={() => dispatch({ type: 'SHOW_HISTORY' })}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{event.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {session.shooter} · {formatDate(session.startTime)}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div className="score-big">{scoreStr}</div>
          {session.innerTenCount > 0 && (
            <div style={{ color: 'var(--gold)', fontSize: 13 }}>{session.innerTenCount}X</div>
          )}
        </div>
      </div>

      {stats && (
        <div className="detail-stats">
          <div className="detail-stat">
            <div className="label">Average</div>
            <div className="value">{stats.averageScore.toFixed(2)}</div>
          </div>
          <div className="detail-stat">
            <div className="label">Group size</div>
            <div className="value">{stats.groupSize.toFixed(1)} mm</div>
          </div>
          <div className="detail-stat">
            <div className="label">Windage</div>
            <div className="value">{stats.windage > 0 ? '+' : ''}{stats.windage.toFixed(1)} mm</div>
          </div>
          <div className="detail-stat">
            <div className="label">Elevation</div>
            <div className="value">{stats.elevation > 0 ? '+' : ''}{stats.elevation.toFixed(1)} mm</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, minHeight: 0 }}>
        <TargetCanvas />

        <div style={{ overflowY: 'auto' }}>
          <table className="shot-table">
            <thead>
              <tr><th>#</th><th>Score</th><th>x,y</th></tr>
            </thead>
            <tbody>
              {session.series.map((ser, si) => (
                <React.Fragment key={si}>
                  <tr className="series-header">
                    <td colSpan={3}>
                      Series {si + 1} — {
                        ser.shots.filter(s => !s.miss)
                          .reduce((sum, s) => sum + (event.decimalScoring ? s.decimalScore : s.score), 0)
                          .toFixed(event.decimalScoring ? 1 : 0)
                      }
                    </td>
                  </tr>
                  {ser.shots.map(shot => (
                    <tr key={shot.index} className={shot.innerTen ? 'inner-ten' : ''}>
                      <td>{shot.index + 1}</td>
                      <td className="score-cell">
                        {shot.miss ? 'Miss' : event.decimalScoring ? shot.decimalScore.toFixed(1) : shot.score}
                        {shot.innerTen && <span style={{ color: 'var(--gold)', marginLeft: 2 }}>X</span>}
                      </td>
                      <td style={{ fontSize: 10, color: 'var(--text-dimmer)', fontFamily: 'var(--font-mono)' }}>
                        {shot.miss ? '—' : `${shot.adjustedX.toFixed(1)},${shot.adjustedY.toFixed(1)}`}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function SessionHistory(): JSX.Element {
  const { state, dispatch } = useAppContext()
  const [summaries, setSummaries] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    window.api.listSessions().then((rows: unknown) => {
      const list = (rows as Record<string, unknown>[]).map(r => ({
        id: Number(r.id),
        shooter: String(r.shooter ?? ''),
        eventName: String(r.event_name ?? ''),
        eventType: String(r.event_type ?? 'practice') as SessionSummary['eventType'],
        decimalScoring: Boolean(r.decimal_scoring),
        startTime: String(r.start_time ?? ''),
        totalScore: Number(r.total_score ?? 0),
        totalDecimalScore: Number(r.total_decimal_score ?? 0),
        innerTenCount: Number(r.inner_ten_count ?? 0),
        shotCount: Number(r.shot_count ?? 0)
      }))
      setSummaries(list)
    })
  }, [state.view])

  if (selectedId != null) return <DetailView sessionId={selectedId} />

  return (
    <div className="history-view">
      <div className="history-header">
        <div className="history-title">Session History</div>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {summaries.length} saved session{summaries.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="history-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Shooter</th>
              <th>Event</th>
              <th>Type</th>
              <th>Shots</th>
              <th>Score</th>
              <th>X</th>
            </tr>
          </thead>
          <tbody>
            {summaries.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--text-dimmer)', textAlign: 'center', padding: 24 }}>
                  No saved sessions
                </td>
              </tr>
            )}
            {summaries.map(s => (
              <tr key={s.id} onClick={() => setSelectedId(s.id)}>
                <td>{formatDate(s.startTime)}</td>
                <td>{s.shooter}</td>
                <td>{s.eventName}</td>
                <td><span className={`event-badge badge-${s.eventType}`}>{s.eventType}</span></td>
                <td>{s.shotCount}</td>
                <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--gold)' }}>
                  {s.decimalScoring ? s.totalDecimalScore.toFixed(1) : s.totalScore}
                </td>
                <td style={{ color: 'var(--gold)' }}>{s.innerTenCount > 0 ? `${s.innerTenCount}X` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
