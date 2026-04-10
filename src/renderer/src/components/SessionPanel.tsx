import { useEffect, useState, useRef } from 'react'
import { useAppContext } from '../store/AppContext'
import { computeSessionStats, groupIntoSeries } from '../domain/scoring'

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function SessionPanel(): JSX.Element {
  const { state, dispatch } = useAppContext()
  const { session, selectedEvent, settings, calibration } = state
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isActive = session?.status === 'active'

  // Session timer
  useEffect(() => {
    if (isActive) {
      const start = new Date(session!.startTime).getTime()
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - start)
      }, 500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isActive])

  // Match time warning
  const timeLeft = (() => {
    if (!session || session.event.durationMinutes < 0 || !isActive) return null
    const end = new Date(session.startTime).getTime() + session.event.durationMinutes * 60000
    return Math.max(0, end - Date.now())
  })()

  const timeColor = (() => {
    if (timeLeft == null) return 'var(--text)'
    if (timeLeft < 60000) return 'var(--red)'
    if (timeLeft < 600000) return 'var(--orange)'
    return 'var(--text)'
  })()

  const handleStart = async (): Promise<void> => {
    if (!selectedEvent || !settings.shooterName) return

    const now = new Date().toISOString()
    const newSession = {
      id: undefined,
      shooter: settings.shooterName,
      event: selectedEvent,
      status: 'active' as const,
      calibration: { ...calibration },
      startTime: now,
      shots: [],
      series: [{ index: 0, shots: [] }],
      totalScore: 0,
      totalDecimalScore: 0,
      innerTenCount: 0
    }

    // Persist to DB
    const sessionId = await window.api.createSession({
      shooter: newSession.shooter,
      event_id: selectedEvent.id,
      calibration_x: calibration.xOffset,
      calibration_y: calibration.yOffset,
      calibration_angle: calibration.angle,
      start_time: now
    })

    dispatch({ type: 'START_SESSION', session: { ...newSession, id: sessionId } })
  }

  const handleSave = async (): Promise<void> => {
    if (!session || !session.id) return

    const stats = computeSessionStats(session.shots)
    const now = new Date().toISOString()

    const shots = session.shots.map(s => ({
      shot_index: s.index,
      miss: s.miss ? 1 : 0,
      raw_x: s.rawX,
      raw_y: s.rawY,
      calibration_x: s.calibration.xOffset,
      calibration_y: s.calibration.yOffset,
      calibration_angle: s.calibration.angle,
      score: s.score,
      decimal_score: s.decimalScore,
      inner_ten: s.innerTen ? 1 : 0,
      adjusted_x: s.adjustedX,
      adjusted_y: s.adjustedY,
      radius: s.radius,
      timestamp: s.timestamp,
      duration_ms: s.durationMs ?? null
    }))

    await window.api.saveSession({
      sessionId: session.id,
      updates: {
        end_time: now,
        total_score: session.totalScore,
        total_decimal_score: session.totalDecimalScore,
        inner_ten_count: session.innerTenCount,
        shot_count: stats.shotCount,
        average_score: stats.averageScore,
        average_shot_duration_ms: stats.averageShotDurationMs,
        shortest_shot_duration_ms: stats.shortestShotDurationMs,
        longest_shot_duration_ms: stats.longestShotDurationMs,
        windage: stats.windage,
        elevation: stats.elevation,
        mean_radius: stats.meanRadius,
        group_size: stats.groupSize,
        diary_entry: session.diaryEntry ?? ''
      },
      shots
    })

    dispatch({ type: 'SESSION_SAVED', sessionId: session.id })
  }

  const handleDiscard = (): void => {
    if (confirm('Discard this session? All shots will be lost.')) {
      dispatch({ type: 'DISCARD_SESSION' })
    }
  }

  const scoreDisplay = session
    ? session.event.decimalScoring
      ? session.totalDecimalScore.toFixed(1)
      : String(session.totalScore)
    : '—'

  const shotInfo = session
    ? session.event.shotLimit > 0
      ? `${session.shots.length} / ${session.event.shotLimit}`
      : String(session.shots.length)
    : '—'

  return (
    <div className="panel">
      <div className="panel-title">Session</div>

      {!session ? (
        <>
          {!settings.shooterName && (
            <div style={{ fontSize: 11, color: 'var(--orange)', marginBottom: 8 }}>
              Set shooter name in settings
            </div>
          )}
          {!selectedEvent && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
              Select an event above
            </div>
          )}
          <button
            className="btn btn-primary btn-full"
            onClick={handleStart}
            disabled={!selectedEvent || !settings.shooterName}
          >
            Start Session
          </button>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <div className="score-label">Score</div>
            <div className="score-big">{scoreDisplay}</div>
            {session.innerTenCount > 0 && (
              <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>
                {session.innerTenCount}X
              </div>
            )}
          </div>

          <div className="stats-grid" style={{ marginBottom: 12 }}>
            <div className="stat-item">
              <div className="stat-value">{shotInfo}</div>
              <div className="stat-label">Shots</div>
            </div>
            <div className="stat-item">
              <div
                className="stat-value"
                style={{ color: timeColor, fontVariantNumeric: 'tabular-nums' }}
              >
                {timeLeft != null ? formatTime(timeLeft) : formatTime(elapsed)}
              </div>
              <div className="stat-label">{timeLeft != null ? 'Remaining' : 'Elapsed'}</div>
            </div>
          </div>

          <div className="btn-group" style={{ flexDirection: 'column' }}>
            <button
              className="btn btn-success btn-full"
              onClick={handleSave}
              disabled={session.shots.length === 0 || session.status === 'saved'}
            >
              Save Session
            </button>
            <button className="btn btn-full" onClick={handleDiscard} disabled={session.status === 'saved'}>
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  )
}
