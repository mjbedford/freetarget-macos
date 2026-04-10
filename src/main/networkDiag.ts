import os from 'os'
import net from 'net'
import { execFile } from 'child_process'

export interface NetworkIface {
  name: string
  address: string
  family: 'IPv4' | 'IPv6'
  internal: boolean
}

export interface PingResult {
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

export interface PortCheckResult {
  success: boolean
  host: string
  port: number
  latencyMs?: number
  error?: string
}

export function getNetworkInterfaces(): NetworkIface[] {
  const ifaces = os.networkInterfaces()
  const result: NetworkIface[] = []
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue
    for (const addr of addrs) {
      result.push({
        name,
        address: addr.address,
        family: addr.family as 'IPv4' | 'IPv6',
        internal: addr.internal
      })
    }
  }
  return result
}

export function ping(host: string): Promise<PingResult> {
  return new Promise(resolve => {
    // -c 4: send 4 packets  -t 5: overall timeout 5 s  -W 1000: per-packet wait 1 s
    execFile('ping', ['-c', '4', '-t', '5', '-W', '1000', host], { timeout: 12000 }, (err, stdout, stderr) => {
      const raw = (stdout || stderr || String(err)).trim()

      // "4 packets transmitted, 3 received, 25.0% packet loss"
      const statsMatch = raw.match(/(\d+) packets transmitted, (\d+) (?:packets )?received, ([\d.]+)% packet loss/)
      if (!statsMatch) {
        resolve({
          success: false,
          host,
          transmitted: 0,
          received: 0,
          lossPercent: 100,
          rawOutput: raw,
          error: err ? err.message.split('\n')[0] : 'Could not parse ping output'
        })
        return
      }

      const transmitted = parseInt(statsMatch[1])
      const received = parseInt(statsMatch[2])
      const lossPercent = parseFloat(statsMatch[3])

      // "round-trip min/avg/max/stddev = 1.234/2.345/3.456/0.123 ms"
      const rttMatch = raw.match(/min\/avg\/max\/stddev = ([\d.]+)\/([\d.]+)\/([\d.]+)/)

      resolve({
        success: received > 0,
        host,
        transmitted,
        received,
        lossPercent,
        rttMin: rttMatch ? parseFloat(rttMatch[1]) : undefined,
        rttAvg: rttMatch ? parseFloat(rttMatch[2]) : undefined,
        rttMax: rttMatch ? parseFloat(rttMatch[3]) : undefined,
        rawOutput: raw
      })
    })
  })
}

export function checkPort(host: string, port: number): Promise<PortCheckResult> {
  return new Promise(resolve => {
    const socket = new net.Socket()
    const start = Date.now()

    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ success: false, host, port, error: 'Timed out after 3 seconds' })
    }, 3000)

    socket.connect(port, host, () => {
      clearTimeout(timer)
      const latencyMs = Date.now() - start
      socket.destroy()
      resolve({ success: true, host, port, latencyMs })
    })

    socket.on('error', err => {
      clearTimeout(timer)
      resolve({ success: false, host, port, error: err.message })
    })
  })
}
