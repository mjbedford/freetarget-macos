import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '../store/AppContext'

// ── Types matching networkDiag.ts ──────────────────────────────────────────

interface NetworkIface {
  name: string
  address: string
  family: 'IPv4' | 'IPv6'
  internal: boolean
}

interface PingResult {
  success: boolean
  host: string
  transmitted: number
  received: number
  lossPercent: number
  rttMin?: number
  rttAvg?: number
  rttMax?: number
  rawOutput: string
  error?: string
}

interface PortCheckResult {
  success: boolean
  host: string
  port: number
  latencyMs?: number
  error?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ifaceSummary(ifaces: NetworkIface[]): NetworkIface[] {
  return ifaces.filter(i => !i.internal && i.family === 'IPv4')
}

// Guess the best matching interface for a given target host
function matchingIface(ifaces: NetworkIface[], host: string): string | null {
  const parts = host.split('.')
  if (parts.length < 3) return null
  const prefix = parts.slice(0, 3).join('.')
  const match = ifaces.find(i => i.address.startsWith(prefix))
  return match ? match.name : null
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusIcon({ ok }: { ok: boolean }): JSX.Element {
  return (
    <span style={{ color: ok ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginRight: 6 }}>
      {ok ? '✓' : '✗'}
    </span>
  )
}

function RunningDots(): JSX.Element {
  return <span style={{ color: 'var(--text-dimmer)' }}>running…</span>
}

// ── Main component ─────────────────────────────────────────────────────────

export function NetworkDiagnosticsPanel(): JSX.Element {
  const { state } = useAppContext()
  const { settings } = state

  const [open, setOpen] = useState(false)
  const [ifaces, setIfaces] = useState<NetworkIface[]>([])
  const [pingResult, setPingResult] = useState<PingResult | null>(null)
  const [portResult, setPortResult] = useState<PortCheckResult | null>(null)
  const [pingRunning, setPingRunning] = useState(false)
  const [portRunning, setPortRunning] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const host = settings.tcpAddress || '192.168.10.9'
  const port = settings.tcpPort || 1090

  const refreshIfaces = useCallback(async () => {
    const list = (await window.api.networkInterfaces()) as NetworkIface[]
    setIfaces(list)
  }, [])

  useEffect(() => {
    if (open) {
      refreshIfaces()
      setPingResult(null)
      setPortResult(null)
      setShowRaw(false)
    }
  }, [open, refreshIfaces])

  const runPing = async (): Promise<void> => {
    setPingRunning(true)
    setPingResult(null)
    const result = (await window.api.ping(host)) as PingResult
    setPingResult(result)
    setPingRunning(false)
  }

  const runPortCheck = async (): Promise<void> => {
    setPortRunning(true)
    setPortResult(null)
    const result = (await window.api.checkPort(host, port)) as PortCheckResult
    setPortResult(result)
    setPortRunning(false)
  }

  const runAll = async (): Promise<void> => {
    await Promise.all([runPing(), runPortCheck()])
  }

  const external = ifaceSummary(ifaces)
  const matched = matchingIface(external, host)

  return (
    <>
      <button
        className="btn btn-full"
        style={{ margin: '0 12px 8px', width: 'calc(100% - 24px)' }}
        onClick={() => setOpen(true)}
      >
        Network
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
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              width: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column'
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
              <span style={{ fontSize: 14, fontWeight: 600 }}>Network Diagnostics</span>
              <button className="btn" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Network interfaces */}
              <section>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8
                  }}
                >
                  <div className="panel-title" style={{ margin: 0 }}>Network Interfaces</div>
                  <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={refreshIfaces}>
                    Refresh
                  </button>
                </div>

                {external.length === 0 ? (
                  <div style={{ color: 'var(--text-dimmer)', fontSize: 12 }}>No active IPv4 interfaces found.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Interface', 'IP Address', ''].map(h => (
                          <th
                            key={h}
                            style={{
                              textAlign: 'left',
                              padding: '4px 8px',
                              color: 'var(--text-dimmer)',
                              fontSize: 10,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              borderBottom: '1px solid var(--border)'
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {external.map(i => {
                        const isMatch = i.name === matched
                        return (
                          <tr key={i.name + i.address}>
                            <td style={{ padding: '5px 8px', color: isMatch ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                              {i.name}
                            </td>
                            <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                              {i.address}
                            </td>
                            <td style={{ padding: '5px 8px', color: 'var(--text-dimmer)', fontSize: 11 }}>
                              {isMatch ? '← same subnet as target' : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {external.length > 0 && !matched && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '6px 10px',
                      background: 'rgba(255,159,10,0.1)',
                      border: '1px solid rgba(255,159,10,0.3)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: 'var(--orange)'
                    }}
                  >
                    No interface on the same subnet as {host}. Connect your Mac to the
                    target's Wi-Fi network (SSID starts with "FET-") before testing.
                  </div>
                )}
              </section>

              {/* Target */}
              <section>
                <div className="panel-title" style={{ marginBottom: 10 }}>Target Connection</div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: 'var(--surface2)',
                    borderRadius: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13
                  }}
                >
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Target</span>
                  <span style={{ fontWeight: 600 }}>{host}</span>
                  <span style={{ color: 'var(--text-dimmer)' }}>:</span>
                  <span style={{ fontWeight: 600 }}>{port}</span>
                  <div style={{ flex: 1 }} />
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12 }}
                    onClick={runAll}
                    disabled={pingRunning || portRunning}
                  >
                    {(pingRunning || portRunning) ? 'Testing…' : 'Test All'}
                  </button>
                </div>

                {/* Ping result */}
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Ping (ICMP)</span>
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={runPing}
                      disabled={pingRunning}
                    >
                      {pingRunning ? 'Running…' : 'Ping'}
                    </button>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg)',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      minHeight: 42,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    {pingRunning && <RunningDots />}
                    {!pingRunning && !pingResult && (
                      <span style={{ color: 'var(--text-dimmer)' }}>—</span>
                    )}
                    {pingResult && (
                      <>
                        <div>
                          <StatusIcon ok={pingResult.success} />
                          {pingResult.success ? (
                            <>
                              <span style={{ color: 'var(--green)' }}>
                                {pingResult.received}/{pingResult.transmitted} packets
                              </span>
                              <span style={{ color: 'var(--text-dim)', margin: '0 8px' }}>
                                {pingResult.lossPercent.toFixed(0)}% loss
                              </span>
                              {pingResult.rttAvg != null && (
                                <span style={{ color: 'var(--text)' }}>
                                  avg {pingResult.rttAvg.toFixed(2)} ms
                                  <span style={{ color: 'var(--text-dimmer)', fontSize: 11 }}>
                                    {' '}(min {pingResult.rttMin?.toFixed(2)} / max {pingResult.rttMax?.toFixed(2)})
                                  </span>
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: 'var(--red)' }}>
                              {pingResult.error ?? `${pingResult.received}/${pingResult.transmitted} packets received`}
                            </span>
                          )}
                        </div>
                        {pingResult.rawOutput && (
                          <div>
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-dimmer)',
                                fontSize: 11,
                                cursor: 'pointer',
                                padding: 0,
                                fontFamily: 'var(--font)'
                              }}
                              onClick={() => setShowRaw(v => !v)}
                            >
                              {showRaw ? '▾ hide output' : '▸ show raw output'}
                            </button>
                            {showRaw && (
                              <pre
                                style={{
                                  marginTop: 6,
                                  padding: '8px',
                                  background: 'var(--surface)',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  color: 'var(--text-dim)',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                  maxHeight: 160,
                                  overflowY: 'auto'
                                }}
                              >
                                {pingResult.rawOutput}
                              </pre>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Port check result */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600 }}>TCP Port {port}</span>
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={runPortCheck}
                      disabled={portRunning}
                    >
                      {portRunning ? 'Running…' : 'Check Port'}
                    </button>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg)',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      minHeight: 42,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {portRunning && <RunningDots />}
                    {!portRunning && !portResult && (
                      <span style={{ color: 'var(--text-dimmer)' }}>—</span>
                    )}
                    {portResult && (
                      <span>
                        <StatusIcon ok={portResult.success} />
                        {portResult.success ? (
                          <>
                            <span style={{ color: 'var(--green)' }}>Port open</span>
                            {portResult.latencyMs != null && (
                              <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                                {portResult.latencyMs} ms
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--red)' }}>{portResult.error}</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {/* Guidance */}
              <section
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  lineHeight: 1.7
                }}
              >
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  Troubleshooting tips
                </strong>
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  <li>Connect your Mac to the target's Wi-Fi (SSID starts with <code style={{ fontFamily: 'var(--font-mono)' }}>FET-</code>)</li>
                  <li>Default target address is <code style={{ fontFamily: 'var(--font-mono)' }}>192.168.10.9:1090</code> — check Settings if different</li>
                  <li>Ping succeeds but port fails → target firmware may not be running</li>
                  <li>Both fail → Mac is not on the right network, or target is off</li>
                </ul>
              </section>

            </div>
          </div>
        </div>
      )}
    </>
  )
}
