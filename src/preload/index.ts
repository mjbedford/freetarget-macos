import { contextBridge, ipcRenderer } from 'electron'

// Typed API exposed to the renderer via window.api
const api = {
  // Device
  listPorts: (): Promise<string[]> => ipcRenderer.invoke('device:list-ports'),

  connect: (config: {
    type: 'USB' | 'TCP'
    portName?: string
    baudRate?: number
    tcpAddress?: string
    tcpPort?: number
    targetDistance: number
  }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('device:connect', config),

  disconnect: (): Promise<void> => ipcRenderer.invoke('device:disconnect'),

  sendCommand: (cmd: string): Promise<void> => ipcRenderer.invoke('device:send', cmd),

  getStatus: (): Promise<string> => ipcRenderer.invoke('device:status'),

  onConnectionStatus: (
    cb: (data: { status: string; info: string }) => void
  ): (() => void) => {
    const listener = (_: unknown, data: { status: string; info: string }): void => cb(data)
    ipcRenderer.on('device:status-changed', listener)
    return () => ipcRenderer.removeListener('device:status-changed', listener)
  },

  onShotReceived: (cb: (shot: unknown) => void): (() => void) => {
    const listener = (_: unknown, shot: unknown): void => cb(shot)
    ipcRenderer.on('device:shot', listener)
    return () => ipcRenderer.removeListener('device:shot', listener)
  },

  onDeviceEcho: (cb: (echo: { xOffset: number; yOffset: number }) => void): (() => void) => {
    const listener = (_: unknown, echo: { xOffset: number; yOffset: number }): void => cb(echo)
    ipcRenderer.on('device:echo', listener)
    return () => ipcRenderer.removeListener('device:echo', listener)
  },

  onDeviceMessage: (cb: (msg: string) => void): (() => void) => {
    const listener = (_: unknown, msg: string): void => cb(msg)
    ipcRenderer.on('device:message', listener)
    return () => ipcRenderer.removeListener('device:message', listener)
  },

  // Events
  getEvents: (): Promise<unknown[]> => ipcRenderer.invoke('events:list'),

  saveEvent: (ev: unknown): Promise<number> => ipcRenderer.invoke('events:save', ev),

  // Sessions
  createSession: (s: unknown): Promise<number> => ipcRenderer.invoke('session:create', s),

  saveSession: (args: {
    sessionId: number
    updates: unknown
    shots: unknown[]
  }): Promise<number> => ipcRenderer.invoke('session:save', args),

  listSessions: (shooter?: string): Promise<unknown[]> =>
    ipcRenderer.invoke('sessions:list', shooter),

  getSession: (id: number): Promise<unknown> => ipcRenderer.invoke('session:get', id),

  // Network diagnostics
  networkInterfaces: (): Promise<unknown[]> => ipcRenderer.invoke('network:interfaces'),
  ping: (host: string): Promise<unknown> => ipcRenderer.invoke('network:ping', host),
  checkPort: (host: string, port: number): Promise<unknown> => ipcRenderer.invoke('network:check-port', host, port),

  // Settings
  getSettings: (): Promise<Record<string, string>> => ipcRenderer.invoke('settings:get'),

  setSetting: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),

  saveSettings: (settings: Record<string, string>): Promise<void> =>
    ipcRenderer.invoke('settings:set-all', settings)
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
