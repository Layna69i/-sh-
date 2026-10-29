/**
 * État de la Chambre du Shogi : partie (mode Shogi) et table stratégique.
 * Les coups passent par un « transport » : local aujourd'hui, et un adaptateur
 * réseau (Firestore, WebSocket…) pourra s'y brancher pour le multijoueur
 * puisque l'état est entièrement décrit par SFEN + liste de coups.
 */
import { create } from 'zustand'
import {
  initialState,
  legalMoves,
  play,
  outcome,
  chooseAiMove,
  toSfen,
  xy,
  type GameState,
  type Move,
  type HandType,
  type Outcome,
  type Side,
  type PieceType,
} from './engine'
import type { StrategyState, StrategyPiece } from '../data/types'
import { audio } from '../audio/engine'

export interface ShogiTransport {
  id: string
  /** Publie un coup joué localement (no-op en local). */
  send(move: Move, sfenAfter: string): void
}
export const localTransport: ShogiTransport = { id: 'local', send: () => undefined }

export type Selection = { kind: 'board'; sq: number } | { kind: 'hand'; type: HandType } | null
export type StratTool = 'move' | 'piece' | 'marker' | 'arrow' | 'note' | 'erase'

const SAVE_KEY = 'osho.shogi.game'

export function initialStrategy(withPieces = true): StrategyState {
  if (!withPieces) return { pieces: [], markers: [], arrows: [], notes: [] }
  const s = initialState()
  const pieces: StrategyPiece[] = []
  s.board.forEach((p, i) => {
    if (!p) return
    const [x, y] = xy(i)
    pieces.push({ id: `p${i}`, type: p.type, side: p.owner, promoted: false, x, y })
  })
  return { pieces, markers: [], arrows: [], notes: [] }
}

interface ShogiStore {
  mode: 'game' | 'strategy'
  game: GameState
  past: GameState[]
  selected: Selection
  targets: number[]
  promotion: { yes: Move; no: Move } | null
  ai: boolean
  thinking: boolean
  result: Outcome
  lastMove: Move | null
  transport: ShogiTransport
  // table stratégique
  strat: StrategyState
  tool: StratTool
  color: string
  pieceType: PieceType
  pieceSide: Side
  arrowFrom: [number, number] | null
  noteText: string
  dragging: string | null
  planName: string
  // actions
  setMode: (m: 'game' | 'strategy') => void
  clickSquare: (sq: number) => void
  selectHand: (type: HandType, side: Side) => void
  choosePromotion: (promote: boolean) => void
  undo: () => void
  reset: () => void
  setAi: (on: boolean) => void
  stratClick: (x: number, y: number) => void
  setStrat: (s: StrategyState, name?: string) => void
  patch: (p: Partial<ShogiStore>) => void
  movePiece: (id: string, x: number, y: number, snap?: boolean) => void
}

function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) return JSON.parse(raw) as GameState
  } catch {
    /* ignoré */
  }
  return initialState()
}

function persist(g: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(g))
  } catch {
    /* ignoré */
  }
}

const sid = () => Math.random().toString(36).slice(2, 9)

export const useShogi = create<ShogiStore>((set, get) => {
  const commit = (m: Move) => {
    const { game, past, transport } = get()
    const next = play(game, m)
    audio.piece(!!m.captured)
    transport.send(m, toSfen(next))
    const res = outcome(next)
    set({ game: next, past: [...past, game].slice(-300), selected: null, targets: [], promotion: null, lastMove: m, result: res })
    persist(next)
    if (res.kind !== 'ongoing') window.setTimeout(() => audio.ui(res.kind === 'repetition' ? 'tab' : 'confirm'), 350)
    maybeAi()
  }
  const maybeAi = () => {
    const { ai, game, result } = get()
    if (!ai || game.turn !== 1 || result.kind !== 'ongoing') return
    set({ thinking: true })
    window.setTimeout(() => {
      const st = get()
      if (!st.ai || st.game !== game) return set({ thinking: false })
      const m = chooseAiMove(game)
      set({ thinking: false })
      if (m) commit(m)
    }, 650)
  }

  return {
    mode: 'game',
    game: loadGame(),
    past: [],
    selected: null,
    targets: [],
    promotion: null,
    ai: false,
    thinking: false,
    result: { kind: 'ongoing' },
    lastMove: null,
    transport: localTransport,
    strat: initialStrategy(),
    tool: 'move',
    color: '#c0392b',
    pieceType: 'P',
    pieceSide: 0,
    arrowFrom: null,
    noteText: '',
    dragging: null,
    planName: '',

    setMode: (mode) => set({ mode, selected: null, targets: [], arrowFrom: null }),

    clickSquare: (sq) => {
      const st = get()
      if (st.mode !== 'game' || st.promotion || st.thinking || st.result.kind !== 'ongoing') return
      if (st.ai && st.game.turn === 1) return
      const g = st.game
      const sel = st.selected
      if (sel && st.targets.includes(sq)) {
        const moves = legalMoves(g).filter((m) =>
          sel.kind === 'board' ? !m.drop && m.from === sel.sq && m.to === sq : m.drop && m.type === sel.type && m.to === sq,
        )
        const yes = moves.find((m) => m.promote)
        const no = moves.find((m) => !m.promote)
        if (yes && no) set({ promotion: { yes, no } })
        else if (moves[0]) commit(moves[0])
        return
      }
      const p = g.board[sq]
      if (p && p.owner === g.turn) {
        const targets = [...new Set(legalMoves(g).filter((m) => !m.drop && m.from === sq).map((m) => m.to))]
        set({ selected: { kind: 'board', sq }, targets })
        audio.ui('tab')
      } else set({ selected: null, targets: [] })
    },

    selectHand: (type, side) => {
      const st = get()
      if (st.mode !== 'game' || st.promotion || st.result.kind !== 'ongoing') return
      if (side !== st.game.turn || (st.ai && side === 1)) return
      if (!st.game.hands[side][type]) return
      const targets = [...new Set(legalMoves(st.game).filter((m) => m.drop && m.type === type).map((m) => m.to))]
      set({ selected: { kind: 'hand', type }, targets })
      audio.ui('tab')
    },

    choosePromotion: (promote) => {
      const pr = get().promotion
      if (!pr) return
      commit(promote ? pr.yes : pr.no)
    },

    undo: () => {
      const { past, ai } = get()
      if (!past.length) return
      // contre l'IA, on annule le coup de l'IA et le nôtre
      let steps = 1
      if (ai && past.length >= 2 && get().game.turn === 0) steps = 2
      const prev = past[past.length - steps]
      set({ game: prev, past: past.slice(0, past.length - steps), selected: null, targets: [], promotion: null, lastMove: prev.history[prev.history.length - 1] ?? null, result: outcome(prev), thinking: false })
      persist(prev)
      audio.ui('tab')
    },

    reset: () => {
      const g = initialState()
      set({ game: g, past: [], selected: null, targets: [], promotion: null, lastMove: null, result: { kind: 'ongoing' }, thinking: false })
      persist(g)
      audio.ui('confirm')
    },

    setAi: (on) => {
      set({ ai: on })
      maybeAi()
    },

    /* --------------------- table stratégique --------------------- */
    stratClick: (x, y) => {
      const st = get()
      const s = structuredClone(st.strat)
      const cx = Math.round(x)
      const cy = Math.round(y)
      switch (st.tool) {
        case 'piece':
          s.pieces = s.pieces.filter((p) => !(Math.round(p.x) === cx && Math.round(p.y) === cy))
          s.pieces.push({ id: sid(), type: st.pieceType, side: st.pieceSide, promoted: false, x: cx, y: cy })
          audio.piece()
          break
        case 'marker':
          s.markers.push({ id: sid(), x: cx, y: cy, color: st.color })
          audio.ui('tab')
          break
        case 'arrow':
          if (!st.arrowFrom) {
            set({ arrowFrom: [cx, cy] })
            audio.ui('tab')
            return
          }
          if (st.arrowFrom[0] !== cx || st.arrowFrom[1] !== cy) s.arrows.push({ id: sid(), from: st.arrowFrom, to: [cx, cy], color: st.color })
          set({ arrowFrom: null })
          audio.ui('tab')
          break
        case 'note': {
          const text = st.noteText.trim()
          if (!text) return
          s.notes.push({ id: sid(), x: cx, y: cy, text: text.slice(0, 80) })
          set({ noteText: '' })
          audio.page()
          break
        }
        case 'erase':
          s.pieces = s.pieces.filter((p) => !(Math.round(p.x) === cx && Math.round(p.y) === cy))
          s.markers = s.markers.filter((p) => !(p.x === cx && p.y === cy))
          s.notes = s.notes.filter((p) => !(p.x === cx && p.y === cy))
          s.arrows = s.arrows.filter((a) => !((a.from[0] === cx && a.from[1] === cy) || (a.to[0] === cx && a.to[1] === cy)))
          audio.ui('close')
          break
        default:
          return
      }
      set({ strat: s })
    },
    setStrat: (strat, name) => set({ strat, planName: name ?? get().planName }),
    patch: (p) => set(p),
    movePiece: (id, x, y, snap = false) => {
      const s = get().strat
      const pieces = s.pieces.map((p) => (p.id === id ? { ...p, x: snap ? Math.max(0, Math.min(8, Math.round(x))) : x, y: snap ? Math.max(0, Math.min(8, Math.round(y))) : y } : p))
      set({ strat: { ...s, pieces } })
    },
  }
})

/** Nombre de pièces en réserve, pour l'affichage. */
export const handList = (g: GameState, side: Side) =>
  (['R', 'B', 'G', 'S', 'N', 'L', 'P'] as HandType[]).filter((t) => g.hands[side][t] > 0).map((t) => ({ type: t, count: g.hands[side][t] }))
