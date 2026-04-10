import { useState, useEffect } from 'react'
import { useAppContext } from '../store/AppContext'

export function ConnectionPanel(): JSX.Element {
  const { state } = useAppContext()
  const { connectionStatus, connectionInfo, settings } = state
  const [ports, setPorts] = useState<string[]>([])
  const [selectedPort, setSelectedPort] = useState(settings.portName)
  const [connType, setConnType] = useState<'USB' | 'TCP'>(settings.connectionType)

  useEffect(() => {
    setSelectedPort(settings.portName)
    setConnType(settings.connectionType)
  }, [settings])

  const refreshPorts = async (): Promise<void> => {
    const p = await window.api.listPorts()
    setPorts(p)
    if (p.length > 0 && !selectedPort) setSelectedPort(p[0])
  }

  useEffect(() => { refreshPorts() }, [])

  const handleConnect = async (): Promise<void> => {
    await window.api.connect({
      type: connType,
      portName: selectedPort,
      baudRate: settings.baudRate,
      tcpAddress: settings.tcpAddress,
      tcpPort: settings.tcpPort,
      targetDistance: settings.targetDistance
    })
  }

  const handleDisconnect = (): void => { window.api.disconnect() }

  const isConnected = connectionStatus === 'connected'
  const isConnecting = connectionStatus === 'connecting'

  return (
    <div className="panel">
      <div className="panel-title">Connection</div>

      <div className="connection-row">
        <div className={`status-dot ${connectionStatus}`} />
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {isConnected ? 'Connected' : isConnecting ? 'Connecting…' : 'Disconnected'}
        </span>
      </div>

      {connectionInfo && (
        <div className="connection-info" style={{ marginBottom: 8 }}>{connectionInfo}</div>
      )}

      <div className="seg-control" style={{ marginBottom: 8 }}>
        <button
          className={`seg-btn ${connType === 'USB' ? 'active' : ''}`}
          onClick={() => setConnType('USB')}
          disabled={isConnected || isConnecting}
        >
          USB
        </button>
        <button
          className={`seg-btn ${connType === 'TCP' ? 'active' : ''}`}
          onClick={() => setConnType('TCP')}
          disabled={isConnected || isConnecting}
        >
          TCP/IP
        </button>
      </div>

      {connType === 'USB' ? (
        <div className="field">
          <label>Port</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              value={selectedPort}
              onChange={e => setSelectedPort(e.target.value)}
              disabled={isConnected || isConnecting}
              style={{ flex: 1 }}
            >
              {ports.length === 0 && <option value="">No ports found</option>}
              {ports.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="btn" onClick={refreshPorts} title="Refresh" disabled={isConnected}>↻</button>
          </div>
        </div>
      ) : (
        <div className="connection-info" style={{ marginBottom: 8 }}>
          {settings.tcpAddress}:{settings.tcpPort}
        </div>
      )}

      {!isConnected ? (
        <button
          className="btn btn-primary btn-full"
          onClick={handleConnect}
          disabled={isConnecting || (connType === 'USB' && !selectedPort)}
        >
          {isConnecting ? 'Connecting…' : 'Connect'}
        </button>
      ) : (
        <button className="btn btn-full" onClick={handleDisconnect}>
          Disconnect
        </button>
      )}
    </div>
  )
}
