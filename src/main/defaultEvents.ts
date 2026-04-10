// Default competition events — mirrors EventManager.initializeEvents() from C#
// Stored as plain data; main process inserts these into SQLite on first launch.

export interface DefaultEvent {
  name: string
  type: string
  target_name: string
  decimal_scoring: number
  shot_limit: number
  duration_minutes: number
  caliber: number
  rapid_fire: number
  rf_shots_per_series: number | null
  rf_series_seconds: number | null
  rf_load_seconds: number | null
  final_shots_per_series: number | null
  final_series_seconds: number | null
  final_shots_before_single: number | null
  final_single_shots_per_series: number | null
  final_single_shot_seconds: number | null
}

export const DEFAULT_EVENTS: DefaultEvent[] = [
  {
    name: 'Pistol Practice',
    type: 'practice',
    target_name: 'AirPistol',
    decimal_scoring: 0,
    shot_limit: -1,
    duration_minutes: -1,
    caliber: 4.5,
    rapid_fire: 0,
    rf_shots_per_series: null, rf_series_seconds: null, rf_load_seconds: null,
    final_shots_per_series: null, final_series_seconds: null,
    final_shots_before_single: null, final_single_shots_per_series: null, final_single_shot_seconds: null
  },
  {
    name: 'Pistol Match',
    type: 'match',
    target_name: 'AirPistol',
    decimal_scoring: 0,
    shot_limit: 60,
    duration_minutes: 75,
    caliber: 4.5,
    rapid_fire: 0,
    rf_shots_per_series: null, rf_series_seconds: null, rf_load_seconds: null,
    final_shots_per_series: null, final_series_seconds: null,
    final_shots_before_single: null, final_single_shots_per_series: null, final_single_shot_seconds: null
  },
  {
    name: 'Pistol Final',
    type: 'final',
    target_name: 'AirPistol',
    decimal_scoring: 1,
    shot_limit: 24,
    duration_minutes: -1,
    caliber: 4.5,
    rapid_fire: 0,
    rf_shots_per_series: null, rf_series_seconds: null, rf_load_seconds: null,
    final_shots_per_series: 5,
    final_series_seconds: 250,
    final_shots_before_single: 10,
    final_single_shots_per_series: 2,
    final_single_shot_seconds: 50
  },
  {
    name: 'Rifle Practice',
    type: 'practice',
    target_name: 'AirRifle',
    decimal_scoring: 1,
    shot_limit: -1,
    duration_minutes: -1,
    caliber: 4.5,
    rapid_fire: 0,
    rf_shots_per_series: null, rf_series_seconds: null, rf_load_seconds: null,
    final_shots_per_series: null, final_series_seconds: null,
    final_shots_before_single: null, final_single_shots_per_series: null, final_single_shot_seconds: null
  },
  {
    name: 'Rifle Match',
    type: 'match',
    target_name: 'AirRifle',
    decimal_scoring: 1,
    shot_limit: 60,
    duration_minutes: 75,
    caliber: 4.5,
    rapid_fire: 0,
    rf_shots_per_series: null, rf_series_seconds: null, rf_load_seconds: null,
    final_shots_per_series: null, final_series_seconds: null,
    final_shots_before_single: null, final_single_shots_per_series: null, final_single_shot_seconds: null
  },
  {
    name: 'Rifle Final',
    type: 'final',
    target_name: 'AirRifle',
    decimal_scoring: 1,
    shot_limit: 24,
    duration_minutes: -1,
    caliber: 4.5,
    rapid_fire: 0,
    rf_shots_per_series: null, rf_series_seconds: null, rf_load_seconds: null,
    final_shots_per_series: 5,
    final_series_seconds: 250,
    final_shots_before_single: 10,
    final_single_shots_per_series: 2,
    final_single_shot_seconds: 50
  }
]
