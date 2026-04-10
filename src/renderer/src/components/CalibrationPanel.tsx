import { useAppContext } from '../store/AppContext'
import { Calibration } from '../domain/types'

const STEP = 0.5  // mm increment per nudge
const ANGLE_STEP = 0.5  // degrees per nudge

export function CalibrationPanel(): JSX.Element {
  const { state, dispatch } = useAppContext()
  const { calibration } = state

  const isActive =
    calibration.xOffset !== 0 || calibration.yOffset !== 0 || calibration.angle !== 0

  const update = (delta: Partial<Calibration>): void => {
    dispatch({
      type: 'UPDATE_CALIBRATION',
      calibration: {
        xOffset: calibration.xOffset + (delta.xOffset ?? 0),
        yOffset: calibration.yOffset + (delta.yOffset ?? 0),
        angle: calibration.angle + (delta.angle ?? 0)
      }
    })
  }

  const save = async (): Promise<void> => {
    await window.api.saveSettings({
      calibrationX: String(calibration.xOffset),
      calibrationY: String(calibration.yOffset),
      calibrationAngle: String(calibration.angle)
    })
    dispatch({ type: 'SET_STATUS', message: 'Calibration saved' })
  }

  const reset = (): void => {
    dispatch({ type: 'RESET_CALIBRATION' })
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="panel-title" style={{ margin: 0 }}>Calibration</div>
        {isActive && (
          <span style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 600 }}>ACTIVE</span>
        )}
      </div>

      {/* X offset */}
      <div className="cal-row">
        <span className="cal-label">X (mm)</span>
        <span className={`cal-val ${calibration.xOffset !== 0 ? 'cal-active' : ''}`}>
          {calibration.xOffset > 0 ? '+' : ''}{calibration.xOffset.toFixed(2)}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="nudge-btn" onClick={() => update({ xOffset: -STEP })}>◀</button>
          <button className="nudge-btn" onClick={() => update({ xOffset: +STEP })}>▶</button>
        </div>
      </div>

      {/* Y offset */}
      <div className="cal-row">
        <span className="cal-label">Y (mm)</span>
        <span className={`cal-val ${calibration.yOffset !== 0 ? 'cal-active' : ''}`}>
          {calibration.yOffset > 0 ? '+' : ''}{calibration.yOffset.toFixed(2)}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="nudge-btn" onClick={() => update({ yOffset: -STEP })}>▼</button>
          <button className="nudge-btn" onClick={() => update({ yOffset: +STEP })}>▲</button>
        </div>
      </div>

      {/* Angle */}
      <div className="cal-row">
        <span className="cal-label">Angle (°)</span>
        <span className={`cal-val ${calibration.angle !== 0 ? 'cal-active' : ''}`}>
          {calibration.angle > 0 ? '+' : ''}{calibration.angle.toFixed(2)}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="nudge-btn" onClick={() => update({ angle: -ANGLE_STEP })} title="Clockwise">↻</button>
          <button className="nudge-btn" onClick={() => update({ angle: +ANGLE_STEP })} title="Anti-clockwise">↺</button>
        </div>
      </div>

      <div className="btn-group" style={{ marginTop: 8 }}>
        <button className="btn" onClick={reset} style={{ flex: 1 }}>Reset</button>
        <button className="btn btn-primary" onClick={save} style={{ flex: 1 }}>Save</button>
      </div>
    </div>
  )
}
