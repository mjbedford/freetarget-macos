import { Calibration, Shot, TargetGeometry, Series } from './types'

// Rotate point (x, y) around origin by angleDeg degrees
function rotatePoint(x: number, y: number, angleDeg: number): [number, number] {
  if (angleDeg === 0) return [x, y]
  const rad = angleDeg * (Math.PI / 180)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [cos * x - sin * y, sin * x + cos * y]
}

// Match C# Shot.getX() / getY(): offset first, then rotate
export function computeAdjustedCoords(
  rawX: number,
  rawY: number,
  cal: Calibration
): { adjustedX: number; adjustedY: number; radius: number } {
  const [adjustedX, adjustedY] = rotatePoint(
    rawX + cal.xOffset,
    rawY + cal.yOffset,
    cal.angle
  )

  // Scoring radius: matches C# recomputeRadiusFromXY() — offset only, no rotation
  const radius = Math.sqrt(
    Math.pow(rawX + cal.xOffset, 2) + Math.pow(rawY + cal.yOffset, 2)
  )

  return { adjustedX, adjustedY, radius }
}

export function scoreShot(
  radius: number,
  target: TargetGeometry
): { score: number; decimalScore: number; innerTen: boolean } {
  const outerRadius = target.rings[0] / 2 + target.projectileCaliberMm / 2

  if (radius > outerRadius) {
    return { score: 0, decimalScore: 0.0, innerTen: false }
  }

  // C# aTarget.getScore(): 11 - radius / tenRingRadius
  const rawDecimal = 11 - radius / target.tenRingRadius

  // Truncate to 1 decimal place (Math.trunc, not round), clamp to [0, 10.9]
  const decimalScore = Math.max(0, Math.min(10.9, Math.trunc(rawDecimal * 10) / 10))
  const score = Math.max(0, Math.min(10, Math.floor(decimalScore)))
  const innerTen = radius <= target.innerTenRadius

  return { score, decimalScore, innerTen }
}

export function processShot(
  raw: { x: number; y: number; miss: boolean },
  index: number,
  calibration: Calibration,
  target: TargetGeometry,
  timestamp: string,
  durationMs?: number
): Omit<Shot, 'sessionId'> {
  if (raw.miss) {
    return {
      index,
      miss: true,
      rawX: raw.x,
      rawY: raw.y,
      calibration,
      score: 0,
      decimalScore: 0.0,
      innerTen: false,
      timestamp,
      durationMs,
      adjustedX: raw.x,
      adjustedY: raw.y,
      radius: 0
    }
  }

  const { adjustedX, adjustedY, radius } = computeAdjustedCoords(raw.x, raw.y, calibration)
  const { score, decimalScore, innerTen } = scoreShot(radius, target)

  return {
    index,
    miss: false,
    rawX: raw.x,
    rawY: raw.y,
    calibration,
    score,
    decimalScore,
    innerTen,
    timestamp,
    durationMs,
    adjustedX,
    adjustedY,
    radius
  }
}

// Group shots into series per the spec rules
export function groupIntoSeries(shots: Shot[], event: import('./types').Event): Series[] {
  const series: Series[] = []
  let current: Shot[] = []
  series.push({ index: 0, shots: current })

  for (const shot of shots) {
    let seriesSize: number

    if (event.type === 'final') {
      const before = event.finalShotsBeforeSingle ?? 10
      const perSeries = event.finalShotsPerSeries ?? 5
      const singleSize = event.finalSingleShotsPerSeries ?? 2
      seriesSize = shot.index < before ? perSeries : singleSize
    } else {
      seriesSize = 10
    }

    const startsNew = shot.index > 0 && shot.index % seriesSize === 0

    if (startsNew) {
      current = [shot]
      series.push({ index: series.length, shots: current })
    } else {
      current.push(shot)
    }
  }

  return series
}

// Compute aggregate stats at session save time
export function computeSessionStats(shots: Shot[]): import('./types').SessionStats {
  const withDuration = shots.filter(s => s.durationMs != null)
  const nonMiss = shots.filter(s => !s.miss)

  const durations = withDuration.map(s => s.durationMs!)
  const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
  const minDur = durations.length ? Math.min(...durations) : 0
  const maxDur = durations.length ? Math.max(...durations) : 0

  const windage = nonMiss.length
    ? nonMiss.reduce((s, sh) => s + sh.adjustedX, 0) / nonMiss.length
    : 0
  const elevation = nonMiss.length
    ? nonMiss.reduce((s, sh) => s + sh.adjustedY, 0) / nonMiss.length
    : 0

  // Mean radius from group centre
  const meanRadius = nonMiss.length
    ? nonMiss.reduce(
        (s, sh) =>
          s + Math.sqrt(Math.pow(sh.adjustedX - windage, 2) + Math.pow(sh.adjustedY - elevation, 2)),
        0
      ) / nonMiss.length
    : 0

  // Group size: max centre-to-centre distance between any two shots
  let groupSize = 0
  for (let i = 0; i < nonMiss.length; i++) {
    for (let j = i + 1; j < nonMiss.length; j++) {
      const dx = nonMiss[i].adjustedX - nonMiss[j].adjustedX
      const dy = nonMiss[i].adjustedY - nonMiss[j].adjustedY
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > groupSize) groupSize = d
    }
  }

  return {
    shotCount: shots.length,
    averageScore:
      shots.length
        ? shots.reduce((s, sh) => s + sh.decimalScore, 0) / shots.length
        : 0,
    averageShotDurationMs: avgDur,
    shortestShotDurationMs: minDur,
    longestShotDurationMs: maxDur,
    windage,
    elevation,
    meanRadius,
    groupSize
  }
}
