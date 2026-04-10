import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import {
  AppSettings,
  Calibration,
  ConnectionStatus,
  Event,
  Session,
  SessionSummary,
  Shot,
  Series
} from '../domain/types'
import { groupIntoSeries } from '../domain/scoring'

// ── State ──────────────────────────────────────────────────────────────────

interface AppState {
  connectionStatus: ConnectionStatus
  connectionInfo: string
  events: Event[]
  selectedEvent: Event | null
  calibration: Calibration
  session: Session | null
  pastSessions: SessionSummary[]
  settings: AppSettings
  view: 'shooting' | 'history' | 'sessionDetail'
  detailSession: Session | null
  statusMessage: string
}

const DEFAULT_CALIBRATION: Calibration = { xOffset: 0, yOffset: 0, angle: 0 }

const DEFAULT_SETTINGS: AppSettings = {
  shooterName: '',
  connectionType: 'USB',
  portName: '',
  baudRate: 115200,
  tcpAddress: '192.168.10.9',
  tcpPort: 1090,
  targetDistance: 100,
  ignoreMisses: false,
  drawMeanGroup: true,
  defaultEventId: 1
}

const initialState: AppState = {
  connectionStatus: 'disconnected',
  connectionInfo: '',
  events: [],
  selectedEvent: null,
  calibration: DEFAULT_CALIBRATION,
  session: null,
  pastSessions: [],
  settings: DEFAULT_SETTINGS,
  view: 'shooting',
  detailSession: null,
  statusMessage: 'Ready'
}

// ── Actions ────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CONNECTION'; status: ConnectionStatus; info?: string }
  | { type: 'SET_EVENTS'; events: Event[] }
  | { type: 'SELECT_EVENT'; event: Event }
  | { type: 'START_SESSION'; session: Session }
  | { type: 'ADD_SHOT'; shot: Shot }
  | { type: 'SESSION_SAVED'; sessionId: number }
  | { type: 'DISCARD_SESSION' }
  | { type: 'UPDATE_CALIBRATION'; calibration: Calibration }
  | { type: 'RESET_CALIBRATION' }
  | { type: 'SET_SETTINGS'; settings: AppSettings }
  | { type: 'SET_PAST_SESSIONS'; sessions: SessionSummary[] }
  | { type: 'SHOW_HISTORY' }
  | { type: 'SHOW_DETAIL'; session: Session }
  | { type: 'BACK_TO_SHOOTING' }
  | { type: 'SET_STATUS'; message: string }

// ── Reducer ────────────────────────────────────────────────────────────────

function addShotToSession(session: Session, shot: Shot): Session {
  const shots = [...session.shots, shot]
  const series = groupIntoSeries(shots, session.event)

  // Rebuild series list
  const newSeries: Series[] = series

  return {
    ...session,
    shots,
    series: newSeries,
    totalScore: session.totalScore + shot.score,
    totalDecimalScore: session.totalDecimalScore + shot.decimalScore,
    innerTenCount: session.innerTenCount + (shot.innerTen ? 1 : 0)
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONNECTION':
      return {
        ...state,
        connectionStatus: action.status,
        connectionInfo: action.info ?? state.connectionInfo,
        statusMessage: action.info ?? (action.status === 'disconnected' ? 'Disconnected' : state.statusMessage)
      }

    case 'SET_EVENTS':
      return { ...state, events: action.events }

    case 'SELECT_EVENT':
      return { ...state, selectedEvent: action.event }

    case 'START_SESSION':
      return { ...state, session: action.session, view: 'shooting' }

    case 'ADD_SHOT': {
      if (!state.session) return state
      return {
        ...state,
        session: addShotToSession(state.session, action.shot)
      }
    }

    case 'SESSION_SAVED': {
      if (!state.session) return state
      return {
        ...state,
        session: { ...state.session, id: action.sessionId, status: 'saved' },
        statusMessage: 'Session saved'
      }
    }

    case 'DISCARD_SESSION':
      return { ...state, session: null, statusMessage: 'Session discarded' }

    case 'UPDATE_CALIBRATION':
      return { ...state, calibration: action.calibration }

    case 'RESET_CALIBRATION':
      return { ...state, calibration: DEFAULT_CALIBRATION }

    case 'SET_SETTINGS':
      return { ...state, settings: action.settings }

    case 'SET_PAST_SESSIONS':
      return { ...state, pastSessions: action.sessions }

    case 'SHOW_HISTORY':
      return { ...state, view: 'history' }

    case 'SHOW_DETAIL':
      return { ...state, view: 'sessionDetail', detailSession: action.session }

    case 'BACK_TO_SHOOTING':
      return { ...state, view: 'shooting', detailSession: null }

    case 'SET_STATUS':
      return { ...state, statusMessage: action.message }

    default:
      return state
  }
}

// ── Context ────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider')
  return ctx
}
