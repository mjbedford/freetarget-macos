import { useState } from 'react'
import { useAppContext } from '../store/AppContext'
import { AppSettings } from '../domain/types'

export function SettingsPanel(): JSX.Element {
  const { state, dispatch } = useAppContext()
  const { settings } = state
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AppSettings>(settings)

  const handleOpen = (): void => {
    setForm(settings)
    setOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    const raw: Record<string, string> = {
      shooterName: form.shooterName,
      connectionType: form.connectionType,
      portName: form.portName,
      baudRate: String(form.baudRate),
      tcpAddress: form.tcpAddress,
      tcpPort: String(form.tcpPort),
      targetDistance: String(form.targetDistance),
      ignoreMisses: String(form.ignoreMisses),
      drawMeanGroup: String(form.drawMeanGroup),
      defaultEventId: String(form.defaultEventId)
    }
    await window.api.saveSettings(raw)
    dispatch({ type: 'SET_SETTINGS', settings: form })
    dispatch({ type: 'SET_STATUS', message: 'Settings saved' })
    setOpen(false)
  }

  const set = <K extends keyof AppSettings>(key: K, val: AppSettings[K]): void =>
    setForm(f => ({ ...f, [key]: val }))

  return (
    <>
      <button
        className="btn btn-full"
        style={{ margin: '8px 12px', width: 'calc(100% - 24px)' }}
        onClick={handleOpen}
      >
        ⚙ Settings
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 380, maxHeight: '80vh',
            overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Settings</div>

            <div className="panel-title">Shooter</div>
            <div className="field">
              <label>Name</label>
              <input
                value={form.shooterName}
                onChange={e => set('shooterName', e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="panel-title" style={{ marginTop: 12 }}>Connection</div>

            <div className="seg-control" style={{ marginBottom: 8 }}>
              <button
                className={`seg-btn ${form.connectionType === 'USB' ? 'active' : ''}`}
                onClick={() => set('connectionType', 'USB')}
              >USB</button>
              <button
                className={`seg-btn ${form.connectionType === 'TCP' ? 'active' : ''}`}
                onClick={() => set('connectionType', 'TCP')}
              >TCP/IP</button>
            </div>

            {form.connectionType === 'USB' ? (
              <div className="field">
                <label>Baud rate</label>
                <select
                  value={form.baudRate}
                  onChange={e => set('baudRate', Number(e.target.value))}
                >
                  <option value={9600}>9600</option>
                  <option value={115200}>115200</option>
                  <option value={230400}>230400</option>
                </select>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>IP address</label>
                  <input
                    value={form.tcpAddress}
                    onChange={e => set('tcpAddress', e.target.value)}
                    placeholder="192.168.10.9"
                  />
                </div>
                <div className="field">
                  <label>Port</label>
                  <input
                    type="number"
                    value={form.tcpPort}
                    onChange={e => set('tcpPort', Number(e.target.value))}
                  />
                </div>
              </>
            )}

            <div className="panel-title" style={{ marginTop: 12 }}>Target</div>
            <div className="field">
              <label>Distance correction (%)</label>
              <input
                type="number"
                value={form.targetDistance}
                min={50} max={200}
                onChange={e => set('targetDistance', Number(e.target.value))}
              />
            </div>

            <div className="panel-title" style={{ marginTop: 12 }}>Behaviour</div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={form.ignoreMisses}
                onChange={e => set('ignoreMisses', e.target.checked)}
              />
              Ignore miss detections
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={form.drawMeanGroup}
                onChange={e => set('drawMeanGroup', e.target.checked)}
              />
              Draw mean group on target
            </label>

            <div className="btn-group">
              <button className="btn" style={{ flex: 1 }} onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
