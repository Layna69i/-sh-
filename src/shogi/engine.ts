/**
 * Moteur de shogi complet et sans dépendance.
 * Repère : x = 0..8 de gauche à droite vu par Sente (x = 0 correspond à la colonne 9),
 * y = 0..8 de haut en bas (y = 0 : dernière rangée de Gote). Sente (0) avance vers y décroissant.
 *
 * Règles gérées : déplacements de toutes les pièces, captures, parachutages (drops),
 * promotions (facultatives / obligatoires), interdiction de se mettre en échec,
 * nifu (deux pions non promus sur une colonne), pions/lances/cavaliers sans coup
 * possible, uchifuzume (mat par parachutage de pion), mat, pat (défaite en shogi),
 * répétition quadruple (sennichite, partie nulle — l'échec perpétuel n'est pas départagé).
 * L'état est sérialisable (SFEN) pour de futures parties en réseau.
 */

export type PieceType = 'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P'
export type HandType = Exclude<PieceType, 'K'>
export type Side = 0 | 1

export interface Piece {
  type: PieceType
  owner: Side
  promoted: boolean
}

export interface Move {
  from: number | null
  to: number
  type: PieceType
  promote: boolean
  drop: boolean
  captured?: PieceType
  capturedPromoted?: boolean
}

export interface GameState {
  board: (Piece | null)[]
  hands: [Record<HandType, number>, Record<HandType, number>]
  turn: Side
  ply: number
  history: Move[]
  positions: Record<string, number>
}

export type Outcome = { kind: 'ongoing' } | { kind: 'checkmate'; winner: Side } | { kind: 'stalemate'; winner: Side } | { kind: 'repetition' }

export const HAND_TYPES: HandType[] = ['R', 'B', 'G', 'S', 'N', 'L', 'P']
export const PIECE_NAMES: Record<PieceType, string> = { K: 'Roi', R: 'Tour', B: 'Fou', G: "Général d'or", S: "Général d'argent", N: 'Cavalier', L: 'Lance', P: 'Pion' }
export const PROMOTED_NAMES: Partial<Record<PieceType, string>> = { R: 'Dragon', B: 'Cheval-dragon', S: 'Argent promu', N: 'Cavalier promu', L: 'Lance promue', P: 'Tokin' }

export const idx = (x: number, y: number) => y * 9 + x
export const xy = (i: number): [number, number] => [i % 9, Math.floor(i / 9)]
const inside = (x: number, y: number) => x >= 0 && x < 9 && y >= 0 && y < 9

const emptyHand = (): Record<HandType, number> => ({ R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 })

export function initialState(): GameState {
  const board: (Piece | null)[] = Array(81).fill(null)
  const back: PieceType[] = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L']
  back.forEach((t, x) => {
    board[idx(x, 0)] = { type: t, owner: 1, promoted: false }
    board[idx(x, 8)] = { type: t, owner: 0, promoted: false }
  })
  board[idx(1, 1)] = { type: 'R', owner: 1, promoted: false }
  board[idx(7, 1)] = { type: 'B', owner: 1, promoted: false }
  board[idx(7, 7)] = { type: 'R', owner: 0, promoted: false }
  board[idx(1, 7)] = { type: 'B', owner: 0, promoted: false }
  for (let x = 0; x < 9; x++) {
    board[idx(x, 2)] = { type: 'P', owner: 1, promoted: false }
    board[idx(x, 6)] = { type: 'P', owner: 0, promoted: false }
  }
  const s: GameState = { board, hands: [emptyHand(), emptyHand()], turn: 0, ply: 0, history: [], positions: {} }
  s.positions[positionKey(s)] = 1
  return s
}

export function cloneState(s: GameState): GameState {
  return {
    board: s.board.map((p) => (p ? { ...p } : null)),
    hands: [{ ...s.hands[0] }, { ...s.hands[1] }],
    turn: s.turn,
    ply: s.ply,
    history: s.history.slice(),
    positions: { ...s.positions },
  }
}

/* ------------------------------------------------------------------ */
/* Déplacements                                                         */
/* ------------------------------------------------------------------ */
const GOLD: [number, number][] = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]]
const SILVER: [number, number][] = [[0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]]
const KING: [number, number][] = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]]
const ORTHO: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]]
const DIAG: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]]

/** Cases atteignables par une pièce (sans vérifier l'échec). */
function pieceTargets(board: (Piece | null)[], from: number, out: number[]) {
  const p = board[from]!
  const [x, y] = xy(from)
  const f = p.owner === 0 ? 1 : -1 // retourne dy pour Gote
  const step = (dirs: [number, number][]) => {
    for (const [dx, dy] of dirs) {
      const nx = x + dx
      const ny = y + dy * f
      if (!inside(nx, ny)) continue
      const q = board[idx(nx, ny)]
      if (!q || q.owner !== p.owner) out.push(idx(nx, ny))
    }
  }
  const slide = (dirs: [number, number][]) => {
    for (const [dx, dy] of dirs) {
      let nx = x + dx
      let ny = y + dy * f
      while (inside(nx, ny)) {
        const q = board[idx(nx, ny)]
        if (q) {
          if (q.owner !== p.owner) out.push(idx(nx, ny))
          break
        }
        out.push(idx(nx, ny))
        nx += dx
        ny += dy * f
      }
    }
  }
  if (p.promoted) {
    if (p.type === 'R') {
      slide(ORTHO)
      step(DIAG)
    } else if (p.type === 'B') {
      slide(DIAG)
      step(ORTHO)
    } else step(GOLD)
    return
  }
  switch (p.type) {
    case 'K':
      step(KING)
      break
    case 'G':
      step(GOLD)
      break
    case 'S':
      step(SILVER)
      break
    case 'N':
      step([
        [-1, -2],
        [1, -2],
      ])
      break
    case 'L':
      slide([[0, -1]])
      break
    case 'P':
      step([[0, -1]])
      break
    case 'R':
      slide(ORTHO)
      break
    case 'B':
      slide(DIAG)
      break
  }
}

const inZone = (owner: Side, y: number) => (owner === 0 ? y <= 2 : y >= 6)
const lastRanks = (owner: Side, y: number, n: number) => (owner === 0 ? y < n : y > 8 - n)

/** Une pièce non promue serait-elle sans aucun coup possible sur cette rangée ? */
export function mustPromote(type: PieceType, owner: Side, y: number) {
  if (type === 'P' || type === 'L') return lastRanks(owner, y, 1)
  if (type === 'N') return lastRanks(owner, y, 2)
  return false
}

export function canPromote(p: Piece, fromY: number, toY: number) {
  if (p.promoted || p.type === 'K' || p.type === 'G') return false
  return inZone(p.owner, fromY) || inZone(p.owner, toY)
}

export function findKing(board: (Piece | null)[], owner: Side) {
  for (let i = 0; i < 81; i++) {
    const p = board[i]
    if (p && p.type === 'K' && p.owner === owner) return i
  }
  return -1
}

const scratch: number[] = []
export function isAttacked(board: (Piece | null)[], sq: number, by: Side) {
  for (let i = 0; i < 81; i++) {
    const p = board[i]
    if (!p || p.owner !== by) continue
    scratch.length = 0
    pieceTargets(board, i, scratch)
    if (scratch.includes(sq)) return true
  }
  return false
}

export function inCheck(s: GameState, side: Side = s.turn) {
  const k = findKing(s.board, side)
  return k >= 0 && isAttacked(s.board, k, (1 - side) as Side)
}

/** Applique un coup sur un plateau/réserves (sans validation). */
function applyRaw(board: (Piece | null)[], hands: GameState['hands'], m: Move, side: Side) {
  if (m.drop) {
    board[m.to] = { type: m.type, owner: side, promoted: false }
    hands[side][m.type as HandType]--
    return
  }
  const p = board[m.from!]!
  const target = board[m.to]
  if (target) hands[side][target.type as HandType]++
  board[m.to] = { type: p.type, owner: side, promoted: p.promoted || m.promote }
  board[m.from!] = null
}

function pseudoMoves(s: GameState, side: Side): Move[] {
  const moves: Move[] = []
  const t: number[] = []
  for (let i = 0; i < 81; i++) {
    const p = s.board[i]
    if (!p || p.owner !== side) continue
    t.length = 0
    pieceTargets(s.board, i, t)
    const fy = Math.floor(i / 9)
    for (const to of t) {
      const ty = Math.floor(to / 9)
      const cap = s.board[to]
      const base = { from: i, to, type: p.type, drop: false, captured: cap?.type, capturedPromoted: cap?.promoted }
      const may = canPromote(p, fy, ty)
      const must = !p.promoted && mustPromote(p.type, side, ty)
      if (may) moves.push({ ...base, promote: true })
      if (!must) moves.push({ ...base, promote: false })
    }
  }
  // Parachutages
  const hand = s.hands[side]
  const pawnFiles = new Set<number>()
  for (let i = 0; i < 81; i++) {
    const p = s.board[i]
    if (p && p.owner === side && p.type === 'P' && !p.promoted) pawnFiles.add(i % 9)
  }
  for (const ht of HAND_TYPES) {
    if (!hand[ht]) continue
    for (let i = 0; i < 81; i++) {
      if (s.board[i]) continue
      const [x, y] = xy(i)
      if (mustPromote(ht, side, y)) continue
      if (ht === 'P' && pawnFiles.has(x)) continue
      moves.push({ from: null, to: i, type: ht, promote: false, drop: true })
    }
  }
  return moves
}

function leavesKingSafe(s: GameState, m: Move, side: Side) {
  const board = s.board.slice()
  const hands: GameState['hands'] = [{ ...s.hands[0] }, { ...s.hands[1] }]
  applyRaw(board, hands, m, side)
  const k = findKing(board, side)
  return k < 0 || !isAttacked(board, k, (1 - side) as Side)
}

/** Coups légaux pour le camp au trait. */
export function legalMoves(s: GameState, opts: { skipUchifuzume?: boolean } = {}): Move[] {
  const side = s.turn
  const out: Move[] = []
  for (const m of pseudoMoves(s, side)) {
    if (!leavesKingSafe(s, m, side)) continue
    if (m.drop && m.type === 'P' && !opts.skipUchifuzume && isPawnDropMate(s, m)) continue
    out.push(m)
  }
  return out
}

/** Uchifuzume : le pion parachuté donne-t-il échec et mat immédiat ? */
function isPawnDropMate(s: GameState, m: Move) {
  const side = s.turn
  const opp = (1 - side) as Side
  const [x, y] = xy(m.to)
  const ahead = side === 0 ? y - 1 : y + 1
  if (!inside(x, ahead)) return false
  const k = s.board[idx(x, ahead)]
  if (!k || k.type !== 'K' || k.owner !== opp) return false
  const next = cloneState(s)
  applyRaw(next.board, next.hands, m, side)
  next.turn = opp
  return legalMoves(next, { skipUchifuzume: true }).length === 0
}

export function positionKey(s: GameState) {
  let k = ''
  for (const p of s.board) k += p ? (p.owner ? p.type.toLowerCase() : p.type) + (p.promoted ? '+' : '') : '.'
  k += '|' + HAND_TYPES.map((t) => s.hands[0][t]).join('') + '|' + HAND_TYPES.map((t) => s.hands[1][t]).join('') + '|' + s.turn
  return k
}

/** Joue un coup (supposé légal) et retourne le nouvel état. */
export function play(s: GameState, m: Move): GameState {
  const n = cloneState(s)
  applyRaw(n.board, n.hands, m, s.turn)
  n.turn = (1 - s.turn) as Side
  n.ply = s.ply + 1
  n.history.push(m)
  const key = positionKey(n)
  n.positions[key] = (n.positions[key] ?? 0) + 1
  return n
}

export function outcome(s: GameState): Outcome {
  if ((s.positions[positionKey(s)] ?? 0) >= 4) return { kind: 'repetition' }
  if (legalMoves(s).length > 0) return { kind: 'ongoing' }
  const winner = (1 - s.turn) as Side
  return inCheck(s) ? { kind: 'checkmate', winner } : { kind: 'stalemate', winner }
}

/* ------------------------------------------------------------------ */
/* Notation et SFEN                                                     */
/* ------------------------------------------------------------------ */
const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
export const KANJI_SHORT: Record<PieceType, string> = { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' }
export const KANJI_PROMOTED: Partial<Record<PieceType, string>> = { R: '龍', B: '馬', S: '全', N: '圭', L: '杏', P: 'と' }

/** Coordonnée shogi : colonne 1-9 (de droite à gauche pour Sente), rangée 一..九. */
export function squareName(i: number) {
  const [x, y] = xy(i)
  return `${9 - x}${KANJI_NUM[y]}`
}

export function moveLabel(m: Move, side: Side) {
  const mark = side === 0 ? '☗' : '☖'
  const piece = KANJI_SHORT[m.type]
  if (m.drop) return `${mark}${squareName(m.to)}${piece}打`
  return `${mark}${squareName(m.to)}${piece}${m.promote ? '成' : ''}${m.captured ? '×' : ''}`
}

export function toSfen(s: GameState) {
  const rows: string[] = []
  for (let y = 0; y < 9; y++) {
    let row = ''
    let empty = 0
    for (let x = 0; x < 9; x++) {
      const p = s.board[idx(x, y)]
      if (!p) {
        empty++
        continue
      }
      if (empty) row += empty
      empty = 0
      const c = p.owner === 0 ? p.type : p.type.toLowerCase()
      row += (p.promoted ? '+' : '') + c
    }
    if (empty) row += empty
    rows.push(row)
  }
  let hand = ''
  for (const side of [0, 1] as Side[])
    for (const t of HAND_TYPES) {
      const n = s.hands[side][t]
      if (n) hand += (n > 1 ? n : '') + (side === 0 ? t : t.toLowerCase())
    }
  return `${rows.join('/')} ${s.turn === 0 ? 'b' : 'w'} ${hand || '-'} ${s.ply + 1}`
}

export function fromSfen(sfen: string): GameState {
  const [boardPart, turnPart, handPart, movePart] = sfen.trim().split(/\s+/)
  const board: (Piece | null)[] = Array(81).fill(null)
  const rows = boardPart.split('/')
  if (rows.length !== 9) throw new Error('SFEN invalide')
  rows.forEach((row, y) => {
    let x = 0
    let promo = false
    for (const ch of row) {
      if (ch === '+') {
        promo = true
        continue
      }
      if (/\d/.test(ch)) {
        x += Number(ch)
        continue
      }
      const owner: Side = ch === ch.toUpperCase() ? 0 : 1
      board[idx(x, y)] = { type: ch.toUpperCase() as PieceType, owner, promoted: promo }
      promo = false
      x++
    }
  })
  const hands: GameState['hands'] = [emptyHand(), emptyHand()]
  if (handPart && handPart !== '-') {
    let num = ''
    for (const ch of handPart) {
      if (/\d/.test(ch)) {
        num += ch
        continue
      }
      const side: Side = ch === ch.toUpperCase() ? 0 : 1
      hands[side][ch.toUpperCase() as HandType] += num ? Number(num) : 1
      num = ''
    }
  }
  const s: GameState = { board, hands, turn: turnPart === 'w' ? 1 : 0, ply: Math.max(0, Number(movePart ?? 1) - 1), history: [], positions: {} }
  s.positions[positionKey(s)] = 1
  return s
}

/* ------------------------------------------------------------------ */
/* IA débutante : alpha-bêta à 2 demi-coups + finition des captures      */
/* ------------------------------------------------------------------ */
const VALUE: Record<PieceType, number> = { K: 0, P: 1, L: 3, N: 4, S: 5, G: 6, B: 8, R: 10 }
const PROMO_VALUE: Partial<Record<PieceType, number>> = { P: 6, L: 6, N: 6, S: 6, B: 11, R: 13 }

function evaluate(s: GameState, side: Side) {
  let score = 0
  for (let i = 0; i < 81; i++) {
    const p = s.board[i]
    if (!p) continue
    let v = p.promoted ? PROMO_VALUE[p.type] ?? VALUE[p.type] : VALUE[p.type]
    const y = Math.floor(i / 9)
    const adv = p.owner === 0 ? 8 - y : y
    if (p.type !== 'K') v += adv * 0.04
    score += p.owner === side ? v : -v
  }
  for (const t of HAND_TYPES) score += (s.hands[side][t] - s.hands[(1 - side) as Side][t]) * VALUE[t] * 1.1
  return score
}

function order(moves: Move[]) {
  return moves.sort((a, b) => (b.captured ? VALUE[b.captured] : 0) + (b.promote ? 2 : 0) - ((a.captured ? VALUE[a.captured] : 0) + (a.promote ? 2 : 0)))
}

function search(s: GameState, depth: number, alpha: number, beta: number, side: Side): number {
  const moves = legalMoves(s, { skipUchifuzume: true })
  if (!moves.length) return s.turn === side ? -1000 : 1000
  if (depth === 0) return evaluate(s, side)
  const maximize = s.turn === side
  let best = maximize ? -Infinity : Infinity
  for (const m of order(moves)) {
    if (depth === 1 && !m.captured && moves.length > 40 && Math.random() < 0.5) continue
    const v = search(play(s, m), depth - 1, alpha, beta, side)
    if (maximize) {
      best = Math.max(best, v)
      alpha = Math.max(alpha, v)
    } else {
      best = Math.min(best, v)
      beta = Math.min(beta, v)
    }
    if (beta <= alpha) break
  }
  return best
}

export function chooseAiMove(s: GameState): Move | null {
  const side = s.turn
  const moves = order(legalMoves(s))
  if (!moves.length) return null
  let best: Move[] = []
  let bestV = -Infinity
  for (const m of moves) {
    const v = search(play(s, m), 1, -Infinity, Infinity, side) + Math.random() * 0.3
    if (v > bestV + 0.01) {
      bestV = v
      best = [m]
    } else if (Math.abs(v - bestV) <= 0.01) best.push(m)
  }
  return best[Math.floor(Math.random() * best.length)] ?? moves[0]
}
