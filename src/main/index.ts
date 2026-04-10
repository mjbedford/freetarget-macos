import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import {
  initDatabase,
  getEvents,
  saveEvent,
  countEvents,
  createSession,
  saveSession,
  getSessions,
  getSession,
  getAllSettings,
  setSetting
} from './database'
import {
  setMainWindow,
  connect,
  disconnect,
  sendCommand,
  listPorts,
  getStatus
} from './deviceManager'
import { DEFAULT_EVENTS } from './defaultEvents'
import { getNetworkInterfaces, ping, checkPort } from './networkDiag'

// ── App settings defaults ──────────────────────────────────────────────────

const DEFAULT_SETTINGS: Record<string, string> = {
  shooterName: '',
  connectionType: 'USB',
  portName: '',
  baudRate: '115200',
  tcpAddress: '192.168.10.9',
  tcpPort: '1090',
  targetDistance: '100',
  ignoreMisses: 'false',
  drawMeanGroup: 'true',
  defaultEventId: '1'
}

// ── Window creation ────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    win.loadURL(rendererUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setAppUserModelId('com.freetarget.macos')

  initDatabase()

  // Seed default events if DB is empty
  if (countEvents() === 0) {
    for (const ev of DEFAULT_EVENTS) {
      saveEvent(ev as Record<string, unknown>)
    }
  }

  const win = createWindow()
  setMainWindow(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow()
      setMainWindow(w)
    }
  })
})

app.on('window-all-closed', () => {
  disconnect()
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC handlers ───────────────────────────────────────────────────────────

ipcMain.handle('device:list-ports', async () => listPorts())

ipcMain.handle('device:connect', async (_e, config) => {
  try {
    connect(config)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('device:disconnect', async () => { disconnect() })

ipcMain.handle('device:send', async (_e, cmd: string) => { sendCommand(cmd) })

ipcMain.handle('device:status', async () => getStatus())

ipcMain.handle('events:list', async () => getEvents())

ipcMain.handle('events:save', async (_e, ev) => saveEvent(ev))

ipcMain.handle('session:create', async (_e, s) => createSession(s))

ipcMain.handle('session:save', async (_e, { sessionId, updates, shots }) => {
  saveSession(sessionId, updates, shots)
  return sessionId
})

ipcMain.handle('sessions:list', async (_e, shooter?: string) => getSessions(shooter))

ipcMain.handle('session:get', async (_e, id: number) => getSession(id))

ipcMain.handle('settings:get', async () => {
  const stored = getAllSettings()
  return { ...DEFAULT_SETTINGS, ...stored }
})

ipcMain.handle('settings:set', async (_e, key: string, value: string) => {
  setSetting(key, value)
})

ipcMain.handle('settings:set-all', async (_e, settings: Record<string, string>) => {
  for (const [k, v] of Object.entries(settings)) {
    setSetting(k, v)
  }
})

ipcMain.handle('network:interfaces', async () => getNetworkInterfaces())
ipcMain.handle('network:ping', async (_e, host: string) => ping(host))
ipcMain.handle('network:check-port', async (_e, host: string, port: number) => checkPort(host, port))
