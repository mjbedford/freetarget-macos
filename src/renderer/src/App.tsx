import { useEffect, useCallback } from 'react'
import { AppProvider, useAppContext } from './store/AppContext'
import { ConnectionPanel } from './components/ConnectionPanel'
import { EventSelector } from './components/EventSelector'
import { SessionPanel } from './components/SessionPanel'
import { TargetCanvas } from './components/TargetCanvas'
import { ShotList } from './components/ShotList'
import { CalibrationPanel } from './components/CalibrationPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { NetworkDiagnosticsPanel } from './components/NetworkDiagnosticsPanel'
import { SessionHistory } from './components/SessionHistory'
import { StatusBar } from './components/StatusBar'
import { processShot } from './domain/scoring'
import { Event, RawShotData, AppSettings } from './domain/types'
import { getTargetByName } from './domain/targets'
import './App.css'

declare global {
  interface Window {
    // Exposed via contextBridge in preload/index.ts
    api: {
      listPorts: () => Promise<string[]>
      connect: (c: {
        type: 'USB' | 'TCP'
        portName?: string
        baudRate?: number
        tcpAddress?: string
        tcpPort?: number
        targetDistance: number
      }) => Promise<{ success: boolean; error?: string }>
      disconnect: () => Promise<void>
      sendCommand: (cmd: string) => Promise<void>
      getStatus: () => Promise<string>
      onConnectionStatus: (cb: (d: { status: string; info: string }) => void) => () => void
      onShotReceived: (cb: (shot: unknown) => void) => () => void
      onDeviceEcho: (cb: (echo: { xOffset: number; yOffset: number }) => void) => () => void
      onDeviceMessage: (cb: (msg: string) => void) => () => void
      getEvents: () => Promise<unknown[]>
      saveEvent: (ev: unknown) => Promise<number>
      createSession: (s: unknown) => Promise<number>
      saveSession: (a: { sessionId: number; updates: unknown; shots: unknown[] }) => Promise<number>
      listSessions: (shooter?: string) => Promise<unknown[]>
      getSession: (id: number) => Promise<unknown>
      getSettings: () => Promise<Record<string, string>>
      setSetting: (key: string, value: string) => Promise<void>
      saveSettings: (settings: Record<string, string>) => Promise<void>
      networkInterfaces: () => Promise<unknown[]>
      ping: (host: string) => Promise<unknown>
      checkPort: (host: string, port: number) => Promise<unknown>
    }
  }
}

// Map DB row → Event
function rowToEvent(row: Record<string, unknown>): Event {
  const targetName = String(row.target_name ?? 'AirRifle')
  const caliber = Number(row.caliber ?? 4.5)
  return {
    id: Number(row.id),
    name: String(row.name),
    type: String(row.type) as Event['type'],
    target: getTargetByName(targetName, caliber),
    decimalScoring: Boolean(row.decimal_scoring),
    shotLimit: Number(row.shot_limit ?? -1),
    durationMinutes: Number(row.duration_minutes ?? -1),
    caliber,
    rapidFire: Boolean(row.rapid_fire),
    rfShotsPerSeries: row.rf_shots_per_series != null ? Number(row.rf_shots_per_series) : undefined,
    rfSeriesSeconds: row.rf_series_seconds != null ? Number(row.rf_series_seconds) : undefined,
    rfLoadSeconds: row.rf_load_seconds != null ? Number(row.rf_load_seconds) : undefined,
    finalShotsPerSeries: row.final_shots_per_series != null ? Number(row.final_shots_per_series) : undefined,
    finalSeriesSeconds: row.final_series_seconds != null ? Number(row.final_series_seconds) : undefined,
    finalShotsBeforeSingle: row.final_shots_before_single != null ? Number(row.final_shots_before_single) : undefined,
    finalSingleShotsPerSeries: row.final_single_shots_per_series != null ? Number(row.final_single_shots_per_series) : undefined,
    finalSingleShotSeconds: row.final_single_shot_seconds != null ? Number(row.final_single_shot_seconds) : undefined
  }
}

function mapSettings(raw: Record<string, string>): AppSettings {
  return {
    shooterName: raw.shooterName ?? '',
    connectionType: (raw.connectionType as 'USB' | 'TCP') ?? 'USB',
    portName: raw.portName ?? '',
    baudRate: Number(raw.baudRate ?? 115200),
    tcpAddress: raw.tcpAddress ?? '192.168.10.9',
    tcpPort: Number(raw.tcpPort ?? 1090),
    targetDistance: Number(raw.targetDistance ?? 100),
    ignoreMisses: raw.ignoreMisses === 'true',
    drawMeanGroup: raw.drawMeanGroup !== 'false',
    defaultEventId: Number(raw.defaultEventId ?? 1)
  }
}

function AppInner(): JSX.Element {
  const { state, dispatch } = useAppContext()

  // Load events and settings on mount
  useEffect(() => {
    ;(async () => {
      const [evRows, rawSettings] = await Promise.all([
        window.api.getEvents(),
        window.api.getSettings()
      ])

      const events = (evRows as Record<string, unknown>[]).map(rowToEvent)
      dispatch({ type: 'SET_EVENTS', events })

      const settings = mapSettings(rawSettings as Record<string, string>)
      dispatch({ type: 'SET_SETTINGS', settings })

      const raw = rawSettings as Record<string, string>
      dispatch({
        type: 'UPDATE_CALIBRATION',
        calibration: {
          xOffset: Number(raw.calibrationX ?? 0),
          yOffset: Number(raw.calibrationY ?? 0),
          angle: Number(raw.calibrationAngle ?? 0)
        }
      })

      // Select default event
      const defaultEv = events.find(e => e.id === settings.defaultEventId) ?? events[0]
      if (defaultEv) dispatch({ type: 'SELECT_EVENT', event: defaultEv })
    })()
  }, [])

  // Wire up device IPC listeners
  useEffect(() => {
    const unsubStatus = window.api.onConnectionStatus(({ status, info }) => {
      dispatch({ type: 'SET_CONNECTION', status: status as 'disconnected' | 'connecting' | 'connected', info })
    })

    const unsubEcho = window.api.onDeviceEcho(({ xOffset, yOffset }) => {
      // Device has its own calibration — spec rule CalibrationOverriddenByDevice
      if (xOffset !== 0 || yOffset !== 0) {
        dispatch({
          type: 'UPDATE_CALIBRATION',
          calibration: { xOffset: 0, yOffset: 0, angle: 0 }
        })
        dispatch({ type: 'SET_STATUS', message: 'Device calibration active — local offsets cleared' })
      }
    })

    return () => {
      unsubStatus()
      unsubEcho()
    }
  }, [])

  // Handle incoming shots
  const handleShot = useCallback(
    (rawData: unknown) => {
      if (!state.session || state.session.status === 'saved') return

      const raw = rawData as RawShotData
      const { session, settings, calibration } = state

      if (raw.miss && settings.ignoreMisses) return

      const shots = session.shots
      const prevTimestamp = shots.length > 0 ? shots[shots.length - 1].timestamp : session.startTime
      const now = new Date().toISOString()
      const durationMs = new Date(now).getTime() - new Date(prevTimestamp).getTime()

      const shot = processShot(
        { x: raw.x, y: raw.y, miss: raw.miss },
        shots.length,
        calibration,
        session.event.target,
        now,
        durationMs
      )

      dispatch({ type: 'ADD_SHOT', shot })
      dispatch({
        type: 'SET_STATUS',
        message: raw.miss
          ? `Miss (shot ${shots.length + 1})`
          : `Shot ${shots.length + 1}: ${session.event.decimalScoring ? shot.decimalScore.toFixed(1) : shot.score}${shot.innerTen ? ' X' : ''}`
      })
    },
    [state.session, state.settings, state.calibration]
  )

  useEffect(() => {
    const unsub = window.api.onShotReceived(handleShot)
    return unsub
  }, [handleShot])

  return (
    <div className="app">
      <div className="titlebar">
        <div className="titlebar-traffic-lights" />
        <span className="titlebar-title">freETarget</span>
        <div className="titlebar-spacer" />
      </div>

      {state.view === 'history' || state.view === 'sessionDetail' ? (
        <SessionHistory />
      ) : (
        <div className="main-layout">
          <aside className="sidebar-left">
            <SettingsPanel />
            <ConnectionPanel />
            <EventSelector />
            <SessionPanel />
            <CalibrationPanel />
            <DiagnosticsPanel />
            <NetworkDiagnosticsPanel />
          </aside>

          <main className="target-area">
            <TargetCanvas />
          </main>

          <aside className="sidebar-right">
            <ShotList />
          </aside>
        </div>
      )}

      <StatusBar />
    </div>
  )
}

export default function App(): JSX.Element {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
