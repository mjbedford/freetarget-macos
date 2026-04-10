import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppContext } from '../store/AppContext'

interface LogEntry {
  id: number
  time: string
  dir: 'rx' | 'tx'
  text: string
}

const MAX_ENTRIES = 500

export function DiagnosticsPanel(): JSX.Element {
  const { state } = useAppContext()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [command, setCommand] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const counterRef = useRef(0)
  const autoScrollRef = useRef(true)

  const addEntry = useCallback((dir: LogEntry['dir'], text: string) => {
    const now = new Date()
    const time =
      now.toTimeString().slice(0, 8) +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0')
    const entry: LogEntry = { id: counterRef.current++, time, dir, text }
    setEntries(prev => {
      const next = [...prev, entry]
      return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
    })
  }, [])

  // Subscribe always so the buffer fills before the panel is opened
  useEffect(() => {
    return window.api.onDeviceMessage(msg => addEntry('rx', msg))
  }, [addEntry])

  // Auto-scroll when new entries arrive (only if already at bottom)
  useEffect(() => {
    if (!open) return
    const el = logRef.current
    if (!el) return
    if (autoScrollRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleScroll = (): void => {
    const el = logRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    autoScrollRef.current = atBottom
  }

  const handleSend = (): void => {
    const cmd = command.trim()
    if (!cmd) return
    window.api.sendCommand(cmd)
    addEntry('tx', cmd)
    setCommand('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <>
      <button
        className="btn btn-full"
        style={{ margin: '0 12px 8px', width: 'calc(100% - 24px)' }}
        onClick={() => setOpen(true)}
      >
        Diagnostics
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              width: 720,
              height: 540,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Device Diagnostics</span>
                <div className={`status-dot ${state.connectionStatus}`} />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {state.connectionInfo || 'Disconnected'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn"
                  onClick={() => { setEntries([]); autoScrollRef.current = true }}
                >
                  Clear
                </button>
                <button className="btn" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>

            {/* Log */}
            <div
              ref={logRef}
              onScroll={handleScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '6px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.6,
                background: 'var(--bg)'
              }}
            >
              {entries.length === 0 ? (
                <div style={{ color: 'var(--text-dimmer)', padding: '8px 4px' }}>
                  No messages yet. Connect to a device to see incoming data.
                </div>
              ) : (
                entries.map(e => (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'baseline',
                      padding: '1px 4px',
                      borderRadius: 3
                    }}
                  >
                    <span style={{ color: 'var(--text-dimmer)', flexShrink: 0, minWidth: 96 }}>
                      {e.time}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        minWidth: 22,
                        fontWeight: 700,
                        fontSize: 10,
                        color: e.dir === 'rx' ? 'var(--green)' : 'var(--accent)'
                      }}
                    >
                      {e.dir === 'rx' ? 'RX' : 'TX'}
                    </span>
                    <span
                      style={{
                        color: e.dir === 'rx' ? 'var(--text)' : 'var(--accent)',
                        wordBreak: 'break-all'
                      }}
                    >
                      {e.text}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Command input */}
            <div
              style={{
                padding: '10px 12px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 6,
                flexShrink: 0
              }}
            >
              <input
                ref={inputRef}
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Send command  e.g.  {"VERSION":7}'
                disabled={state.connectionStatus !== 'connected'}
                style={{
                  flex: 1,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  padding: '5px 10px',
                  outline: 'none',
                  opacity: state.connectionStatus !== 'connected' ? 0.4 : 1
                }}
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={state.connectionStatus !== 'connected' || !command.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
