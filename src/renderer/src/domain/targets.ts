import { TargetGeometry } from './types'

// Ring values match the original freETarget C# source exactly.
// All ring values are diameters in mm.

export function createAirRifle(caliberMm = 4.5): TargetGeometry {
  const ring10 = 0.5
  const rings = [45.5, 40.5, 35.5, 30.5, 25.5, 20.5, 15.5, 10.5, 5.5, ring10]
  return {
    name: 'AirRifle',
    displayName: '10m Air Rifle',
    totalSizeMm: 80,
    rings,
    blackDiameterMm: 30.5,        // ring4
    blackRingCutoff: 4,
    firstRingNumber: 1,
    tenRingRadius: ring10 / 2 + caliberMm / 2,           // 0.25 + 2.25 = 2.5
    innerTenRadius: caliberMm / 2 - ring10 / 2,          // 2.25 - 0.25 = 2.0 (shot out completely)
    projectileCaliberMm: caliberMm,
    solidInner: true
  }
}

export function createAirPistol(caliberMm = 4.5): TargetGeometry {
  const ring10 = 11.5
  const innerRing = 5.0
  const rings = [155.5, 139.5, 123.5, 107.5, 91.5, 75.5, 59.5, 43.5, 27.5, ring10, innerRing]
  return {
    name: 'AirPistol',
    displayName: '10m Air Pistol',
    totalSizeMm: 170,
    rings,
    blackDiameterMm: 59.5,        // ring7
    blackRingCutoff: 7,
    firstRingNumber: 1,
    tenRingRadius: ring10 / 2 + caliberMm / 2,           // 5.75 + 2.25 = 8.0
    innerTenRadius: innerRing / 2 + caliberMm / 2,       // 2.5 + 2.25 = 4.75
    projectileCaliberMm: caliberMm,
    solidInner: false
  }
}

export const TARGET_REGISTRY: Record<string, (caliber: number) => TargetGeometry> = {
  AirRifle: createAirRifle,
  AirPistol: createAirPistol
}

export function getTargetByName(name: string, caliber = 4.5): TargetGeometry {
  const factory = TARGET_REGISTRY[name]
  if (!factory) throw new Error(`Unknown target: ${name}`)
  return factory(caliber)
}

// Default competition events matching EventManager.initializeEvents()
export function getDefaultEvents(): Omit<import('./types').Event, 'id'>[] {
  return [
    {
      name: 'Pistol Practice',
      type: 'practice',
      target: createAirPistol(4.5),
      decimalScoring: false,
      shotLimit: -1,
      durationMinutes: -1,
      caliber: 4.5,
      rapidFire: false
    },
    {
      name: 'Pistol Match',
      type: 'match',
      target: createAirPistol(4.5),
      decimalScoring: false,
      shotLimit: 60,
      durationMinutes: 75,
      caliber: 4.5,
      rapidFire: false
    },
    {
      name: 'Pistol Final',
      type: 'final',
      target: createAirPistol(4.5),
      decimalScoring: true,
      shotLimit: 24,
      durationMinutes: -1,
      caliber: 4.5,
      rapidFire: false,
      finalShotsPerSeries: 5,
      finalSeriesSeconds: 250,
      finalShotsBeforeSingle: 10,
      finalSingleShotsPerSeries: 2,
      finalSingleShotSeconds: 50
    },
    {
      name: 'Rifle Practice',
      type: 'practice',
      target: createAirRifle(4.5),
      decimalScoring: true,
      shotLimit: -1,
      durationMinutes: -1,
      caliber: 4.5,
      rapidFire: false
    },
    {
      name: 'Rifle Match',
      type: 'match',
      target: createAirRifle(4.5),
      decimalScoring: true,
      shotLimit: 60,
      durationMinutes: 75,
      caliber: 4.5,
      rapidFire: false
    },
    {
      name: 'Rifle Final',
      type: 'final',
      target: createAirRifle(4.5),
      decimalScoring: true,
      shotLimit: 24,
      durationMinutes: -1,
      caliber: 4.5,
      rapidFire: false,
      finalShotsPerSeries: 5,
      finalSeriesSeconds: 250,
      finalShotsBeforeSingle: 10,
      finalSingleShotsPerSeries: 2,
      finalSingleShotSeconds: 50
    }
  ]
}
