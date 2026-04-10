import { BrowserWindow } from 'electron'
import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'
import net from 'net'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface DeviceConfig {
  type: 'USB' | 'TCP'
  portName?: string
  baudRate?: number
  tcpAddress?: string
  tcpPort?: number
  targetDistance: number   // percentage, 100 = no scaling
}

export interface RawShotData {
  count: number
  x: number
  y: number
  radius?: number
  angle?: number
  miss: boolean
}

let mainWindow: BrowserWindow | null = null
let serialPort: SerialPort | null = null
let tcpSocket: net.Socket | null = null
let currentStatus: ConnectionStatus = 'disconnected'
let jsonAccumulator = ''

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

function emit(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function setStatus(status: ConnectionStatus, info = ''): void {
  currentStatus = status
  emit('device:status-changed', { status, info })
}

// Scale coordinates based on target distance setting
function scaleCoord(value: number, targetDistance: number): number {
  return (100 * value) / targetDistance
}

// Parse a JSON message from the device (without the outer braces)
function parseDeviceMessage(json: string, targetDistance: number): void {
  try {
    const obj = JSON.parse(`{${json}}`)

    // Shot message
    if ('shot' in obj) {
      const miss = obj['miss'] === 1

      const raw: RawShotData = {
        count: Number(obj['shot'] ?? 0),
        x: miss ? 0 : scaleCoord(Number(obj['x'] ?? 0), targetDistance),
        y: miss ? 0 : scaleCoord(Number(obj['y'] ?? 0), targetDistance),
        radius: obj['r'] != null ? scaleCoord(Number(obj['r']), targetDistance) : undefined,
        angle: obj['a'] != null ? Number(obj['a']) : undefined,
        miss
      }

      emit('device:shot', raw)
    } else if ('X_OFFSET' in obj || 'Y_OFFSET' in obj) {
      // Echo/config response — pass through for calibration override logic
      emit('device:echo', {
        xOffset: Number(obj['X_OFFSET'] ?? 0),
        yOffset: Number(obj['Y_OFFSET'] ?? 0)
      })
    } else {
      emit('device:message', `{${json}}`)
    }
  } catch {
    emit('device:message', `[parse error] {${json}}`)
  }
}

// Process incoming raw text, extracting complete {...} messages
function processIncoming(text: string, targetDistance: number): void {
  jsonAccumulator += text

  let start = jsonAccumulator.indexOf('{')
  while (start !== -1) {
    const end = jsonAccumulator.indexOf('}', start)
    if (end === -1) break

    const inner = jsonAccumulator.slice(start + 1, end)
    parseDeviceMessage(inner, targetDistance)

    jsonAccumulator = jsonAccumulator.slice(end + 1)
    start = jsonAccumulator.indexOf('{')
  }
}

export async function listPorts(): Promise<string[]> {
  try {
    const ports = await SerialPort.list()
    return ports.map(p => p.path)
  } catch {
    return []
  }
}

export function connect(config: DeviceConfig): void {
  if (currentStatus !== 'disconnected') {
    disconnect()
  }

  jsonAccumulator = ''
  setStatus('connecting')

  if (config.type === 'USB') {
    connectUSB(config)
  } else {
    connectTCP(config)
  }
}

function connectUSB(config: DeviceConfig): void {
  const port = new SerialPort({
    path: config.portName!,
    baudRate: config.baudRate ?? 115200,
    autoOpen: false
  })

  serialPort = port

  port.open(err => {
    if (err) {
      setStatus('disconnected', err.message)
      return
    }

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }))

    let confirmed = false
    parser.on('data', (line: string) => {
      const trimmed = line.trim()

      // First message from device confirms connection
      if (!confirmed) {
        confirmed = true
        setStatus('connected', `USB: ${config.portName}`)
        // Request device config
        port.write('{"VERSION":7}\n')
      }

      emit('device:message', trimmed)
      processIncoming(trimmed, config.targetDistance ?? 100)
    })

    port.on('error', err => {
      setStatus('disconnected', err.message)
      serialPort = null
    })

    port.on('close', () => {
      setStatus('disconnected')
      serialPort = null
    })
  })
}

function connectTCP(config: DeviceConfig): void {
  const socket = new net.Socket()
  tcpSocket = socket

  const timeout = setTimeout(() => {
    socket.destroy()
    setStatus('disconnected', 'Connection timed out')
    tcpSocket = null
  }, 10000)

  socket.connect(config.tcpPort ?? 1090, config.tcpAddress ?? '192.168.10.9', () => {
    clearTimeout(timeout)
    setStatus('connected', `TCP: ${config.tcpAddress}:${config.tcpPort}`)
    // Request device config
    socket.write('{"VERSION":7}\n')
  })

  socket.on('data', (data: Buffer) => {
    const text = data.toString('utf8')
    emit('device:message', text.trim())
    processIncoming(text, config.targetDistance ?? 100)
  })

  socket.on('error', err => {
    clearTimeout(timeout)
    setStatus('disconnected', err.message)
    tcpSocket = null
  })

  socket.on('close', () => {
    clearTimeout(timeout)
    setStatus('disconnected')
    tcpSocket = null
  })
}

export function disconnect(): void {
  if (serialPort?.isOpen) {
    serialPort.close()
    serialPort = null
  }
  if (tcpSocket) {
    tcpSocket.destroy()
    tcpSocket = null
  }
  setStatus('disconnected')
}

export function sendCommand(cmd: string): void {
  const payload = cmd.endsWith('\n') ? cmd : cmd + '\n'
  if (serialPort?.isOpen) {
    serialPort.write(payload)
  } else if (tcpSocket) {
    tcpSocket.write(payload)
  }
}

export function getStatus(): ConnectionStatus {
  return currentStatus
}
