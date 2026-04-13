import { useRef, useEffect, useState, useCallback } from 'react'
import { useAppContext } from '../store/AppContext'
import { Shot, TargetGeometry } from '../domain/types'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 8
const PADDING_PX = 20

function getScale(canvasSize: number, target: TargetGeometry, zoom: number): number {
  // Physical target face → canvas pixels
  const usable = canvasSize - PADDING_PX * 2
  return (usable / target.totalSizeMm) * zoom
}

function mmToCanvas(
  mmX: number,
  mmY: number,
  cx: number,
  cy: number,
  scale: number
): [number, number] {
  return [cx + mmX * scale, cy - mmY * scale]  // Y axis flipped
}

function drawTarget(
  ctx: CanvasRenderingContext2D,
  target: TargetGeometry,
  cx: number,
  cy: number,
  scale: number
): void {
  // White background
  ctx.fillStyle = '#f0f0e8'
  ctx.beginPath()
  ctx.arc(cx, cy, (target.totalSizeMm / 2) * scale, 0, Math.PI * 2)
  ctx.fill()

  // Black fill circle
  const blackR = (target.blackDiameterMm / 2) * scale
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(cx, cy, blackR, 0, Math.PI * 2)
  ctx.fill()

  // Ring outlines + numbers
  const firstRing = target.firstRingNumber
  for (let i = 0; i < target.rings.length; i++) {
    const ringNum = firstRing + i
    const rPx = (target.rings[i] / 2) * scale

    const inBlackArea = ringNum < target.blackRingCutoff
    const ringColor = inBlackArea ? '#222' : '#e8e8d8'

    // Solid inner dot for rifle targets
    if (target.solidInner && i === target.rings.length - 1) {
      ctx.fillStyle = '#e8e8d8'
      ctx.beginPath()
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.strokeStyle = ringColor
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Ring number label (north position) — X ring has no label (still scores 10)
    if (rPx > 8 && ringNum <= 10) {
      const nextR = i + 1 < target.rings.length ? (target.rings[i + 1] / 2) * scale : 0
      const diff = rPx - nextR
      if (diff > 6) {
        const labelY = cy - rPx + diff / 2
        ctx.fillStyle = inBlackArea ? '#444' : '#999'
        ctx.font = `${Math.min(10, diff * 0.6)}px -apple-system`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(ringNum), cx, labelY)
      }
    }
  }

  // Inner X circle (dashed)
  const innerXR = target.innerTenRadius * scale
  if (innerXR > 2) {
    ctx.strokeStyle = inBlackArea(target, 10) ? '#444' : '#888'
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.arc(cx, cy, innerXR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function inBlackArea(target: TargetGeometry, ringNum: number): boolean {
  return ringNum < target.blackRingCutoff
}

function drawShots(
  ctx: CanvasRenderingContext2D,
  shots: Shot[],
  cx: number,
  cy: number,
  scale: number,
  target: TargetGeometry
): void {
  const pelletR = (target.projectileCaliberMm / 2) * scale

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]
    if (shot.miss) continue

    const [sx, sy] = mmToCanvas(shot.adjustedX, shot.adjustedY, cx, cy, scale)
    const isLatest = i === shots.length - 1

    let fillColor: string
    let strokeColor: string

    if (isLatest) {
      if (shot.decimalScore >= 10) {
        fillColor = 'rgba(255, 214, 10, 0.85)'
        strokeColor = '#ffd60a'
      } else if (shot.decimalScore >= 9) {
        fillColor = 'rgba(48, 209, 88, 0.85)'
        strokeColor = '#30d158'
      } else {
        fillColor = 'rgba(10, 132, 255, 0.85)'
        strokeColor = '#0a84ff'
      }
    } else {
      fillColor = 'rgba(180, 180, 180, 0.35)'
      strokeColor = 'rgba(180, 180, 180, 0.6)'
    }

    ctx.fillStyle = fillColor
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 0.8

    ctx.beginPath()
    ctx.arc(sx, sy, Math.max(pelletR, 2), 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Shot number label
    if (pelletR > 6) {
      ctx.fillStyle = isLatest ? '#000' : '#aaa'
      ctx.font = `bold ${Math.min(9, pelletR * 0.8)}px -apple-system`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(shot.index + 1), sx, sy + 0.5)
    }
  }
}

function drawMeanGroup(
  ctx: CanvasRenderingContext2D,
  shots: Shot[],
  cx: number,
  cy: number,
  scale: number
): void {
  const nonMiss = shots.filter(s => !s.miss)
  if (nonMiss.length < 2) return

  const meanX = nonMiss.reduce((s, sh) => s + sh.adjustedX, 0) / nonMiss.length
  const meanY = nonMiss.reduce((s, sh) => s + sh.adjustedY, 0) / nonMiss.length
  const meanR =
    nonMiss.reduce(
      (s, sh) =>
        s + Math.sqrt(Math.pow(sh.adjustedX - meanX, 2) + Math.pow(sh.adjustedY - meanY, 2)),
      0
    ) / nonMiss.length

  const [mx, my] = mmToCanvas(meanX, meanY, cx, cy, scale)
  const rPx = meanR * scale

  ctx.strokeStyle = 'rgba(255, 59, 48, 0.7)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([3, 3])

  ctx.beginPath()
  ctx.arc(mx, my, Math.max(rPx, 3), 0, Math.PI * 2)
  ctx.stroke()

  // Cross
  ctx.setLineDash([])
  const cross = 5
  ctx.beginPath()
  ctx.moveTo(mx - cross, my)
  ctx.lineTo(mx + cross, my)
  ctx.moveTo(mx, my - cross)
  ctx.lineTo(mx, my + cross)
  ctx.stroke()
}

export function TargetCanvas(): JSX.Element {
  const { state } = useAppContext()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [canvasSize, setCanvasSize] = useState(480)

  // Use detail session when browsing history, active session when shooting
  const displaySession = state.view === 'sessionDetail' ? state.detailSession : state.session
  const target = displaySession?.event.target ?? state.selectedEvent?.target
  const shots = displaySession?.shots ?? []

  // Resize canvas to fit container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      const size = Math.min(width, height) - 32
      setCanvasSize(Math.max(300, size))
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !target) return

    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize * dpr
    canvas.height = canvasSize * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, canvasSize, canvasSize)

    const cx = canvasSize / 2
    const cy = canvasSize / 2
    const scale = getScale(canvasSize, target, zoom)

    drawTarget(ctx, target, cx, cy, scale)
    drawShots(ctx, shots, cx, cy, scale, target)

    if (state.settings.drawMeanGroup) {
      drawMeanGroup(ctx, shots, cx, cy, scale)
    }

    // Centre crosshair (tiny, when no shots)
    if (shots.length === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(cx - 6, cy)
      ctx.lineTo(cx + 6, cy)
      ctx.moveTo(cx, cy - 6)
      ctx.lineTo(cx, cy + 6)
      ctx.stroke()
    }
  }, [target, shots, canvasSize, zoom, state.settings.drawMeanGroup])

  useEffect(() => { draw() }, [draw])

  const handleZoomIn = (): void => setZoom(z => Math.min(z * 1.5, MAX_ZOOM))
  const handleZoomOut = (): void => setZoom(z => Math.max(z / 1.5, MIN_ZOOM))
  const handleZoomReset = (): void => setZoom(1)

  return (
    <div className="canvas-container" ref={containerRef}>
      {target ? (
        <>
          <canvas
            ref={canvasRef}
            style={{ width: canvasSize, height: canvasSize, borderRadius: 4 }}
          />
          <div className="canvas-controls">
            <button className="btn" onClick={handleZoomOut} title="Zoom out">−</button>
            <button className="btn" onClick={handleZoomReset} title="Reset zoom" style={{ minWidth: 48 }}>
              {Math.round(zoom * 100)}%
            </button>
            <button className="btn" onClick={handleZoomIn} title="Zoom in">+</button>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-dimmer)', fontSize: 14 }}>
          Select an event to see the target
        </div>
      )}
    </div>
  )
}
