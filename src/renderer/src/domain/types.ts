export type SessionType = 'practice' | 'match' | 'final'

export interface TargetGeometry {
  name: string
  displayName: string
  totalSizeMm: number         // physical face size
  rings: number[]             // ring diameters in mm, outermost first (ring 1)
  blackDiameterMm: number     // fill circle for black area
  blackRingCutoff: number     // ring numbers < this drawn in black ink
  firstRingNumber: number     // score of outermost ring (usually 1)
  tenRingRadius: number       // scoring radius: ring10/2 + caliber/2
  innerTenRadius: number      // inner X radius: varies by target type
  projectileCaliberMm: number
  solidInner: boolean         // innermost ring is a filled dot (rifle style)
}

export interface Event {
  id: number
  name: string
  type: SessionType
  target: TargetGeometry
  decimalScoring: boolean
  shotLimit: number           // -1 = unlimited (practice)
  durationMinutes: number     // -1 = unlimited
  caliber: number
  rapidFire: boolean
  rfShotsPerSeries?: number
  rfSeriesSeconds?: number
  rfLoadSeconds?: number
  finalShotsPerSeries?: number
  finalSeriesSeconds?: number
  finalShotsBeforeSingle?: number
  finalSingleShotsPerSeries?: number
  finalSingleShotSeconds?: number
}

export interface Calibration {
  xOffset: number   // mm
  yOffset: number   // mm
  angle: number     // degrees
}

export interface Shot {
  sessionId?: number
  index: number
  miss: boolean
  rawX: number              // mm from centre (from device, distance-scaled)
  rawY: number              // mm from centre
  calibration: Calibration  // snapshot at time of arrival
  score: number             // 0–10
  decimalScore: number      // 0.0–10.9
  innerTen: boolean
  timestamp: string         // ISO date string
  durationMs?: number       // ms since previous shot (or session start)
  // Pre-computed for display (stored with shot)
  adjustedX: number
  adjustedY: number
  radius: number
}

export interface Series {
  index: number
  shots: Shot[]
}

export interface SessionStats {
  shotCount: number
  averageScore: number
  averageShotDurationMs: number
  shortestShotDurationMs: number
  longestShotDurationMs: number
  windage: number      // mean X of non-miss shots
  elevation: number    // mean Y of non-miss shots
  meanRadius: number   // mean radius from group centre
  groupSize: number    // max pairwise distance
}

export interface Session {
  id?: number
  shooter: string
  event: Event
  status: 'active' | 'saved'
  calibration: Calibration
  startTime: string
  endTime?: string
  diaryEntry?: string
  shots: Shot[]
  series: Series[]
  totalScore: number
  totalDecimalScore: number
  innerTenCount: number
  stats?: SessionStats
}

export interface SessionSummary {
  id: number
  shooter: string
  eventName: string
  eventType: SessionType
  decimalScoring: boolean
  startTime: string
  totalScore: number
  totalDecimalScore: number
  innerTenCount: number
  shotCount: number
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export interface AppSettings {
  shooterName: string
  connectionType: 'USB' | 'TCP'
  portName: string
  baudRate: number
  tcpAddress: string
  tcpPort: number
  targetDistance: number  // percentage, 100 = standard
  ignoreMisses: boolean
  drawMeanGroup: boolean
  defaultEventId: number
}

export interface RawShotData {
  count: number
  x: number       // mm (distance-scaled)
  y: number       // mm
  radius?: number // from device (optional)
  angle?: number  // from device (optional)
  miss: boolean
}
