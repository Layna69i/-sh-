/**
 * Plateau de shogi 3D : goban en kaya sur pieds, pièces pentagonales gravées
 * (face promue en rouge au revers, la pièce se retourne à la promotion),
 * komadai pour les pièces capturées, surbrillances des coups légaux.
 * Le même plateau sert au mode Shogi et à la table stratégique.
 */
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { M, cachedMaterial, dynamicTexture } from '../assets'
import { BOARD, genPieceAtlas, ATLAS_COLS, ATLAS_ROWS } from '../../textures/shogiTex'
import { shogiBoardMat } from '../rooms/common'
import { useShogi, handList } from '../../shogi/store'
import { xy, idx, findKing, inCheck, type PieceType, type Side, type HandType } from '../../shogi/engine'
import { latheGeo } from '../geo'
import { damp } from '../../core/math'
import type { StrategyPiece } from '../../data/types'

const SIZE: Record<PieceType, [number, number, number]> = {
  K: [0.037, 0.041, 0.0115],
  R: [0.036, 0.04, 0.011],
  B: [0.036, 0.04, 0.011],
  G: [0.035, 0.039, 0.0105],
  S: [0.035, 0.039, 0.0105],
  N: [0.033, 0.038, 0.01],
  L: [0.031, 0.037, 0.0095],
  P: [0.03, 0.035, 0.009],
}
const GLYPH: Record<PieceType, number> = { K: 0, R: 2, B: 3, G: 4, S: 5, N: 6, L: 7, P: 8 }
const PROMO_GLYPH: Partial<Record<PieceType, number>> = { R: 9, B: 10, S: 11, N: 12, L: 13, P: 14 }

function pentagon(w: number, h: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w * 0.4, h * 0.76)
  s.lineTo(0, h)
  s.lineTo(-w * 0.4, h * 0.76)
  s.closePath()
  return s
}

function decalGeo(w: number, h: number, glyph: number, t: number, bottom: boolean) {
  const shape = pentagon(w * 0.86, h * 0.86)
  const g = new THREE.ShapeGeometry(shape)
  const col = glyph % ATLAS_COLS
  const row = Math.floor(glyph / ATLAS_COLS)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i) / (w * 0.86) + 0.5
    const sy = pos.getY(i) / (h * 0.86)
    uv.setXY(i, (col + sx) / ATLAS_COLS, 1 - (row + 1 - sy) / ATLAS_ROWS)
  }
  g.translate(0, h * 0.06, 0)
  g.rotateX(-Math.PI / 2)
  g.translate(0, t + 0.0016, h / 2)
  if (bottom) {
    // retournement autour de l'axe long (pivot à mi-épaisseur)
    g.translate(0, -t / 2, 0)
    g.rotateZ(Math.PI)
    g.translate(0, t / 2, 0)
  }
  return g
}

interface PieceGeos {
  body: THREE.BufferGeometry
  top: THREE.BufferGeometry
  bottom: THREE.BufferGeometry | null
  t: number
}

function usePieceGeos() {
  return useMemo(() => {
    const out = {} as Record<PieceType | 'K2', PieceGeos>
    for (const type of Object.keys(SIZE) as PieceType[]) {
      const [w, h, t] = SIZE[type]
      const body = new THREE.ExtrudeGeometry(pentagon(w, h), { depth: t, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2 })
      body.rotateX(-Math.PI / 2)
      body.translate(0, 0, h / 2)
      const promo = PROMO_GLYPH[type]
      out[type] = { body, top: decalGeo(w, h, GLYPH[type], t, false), bottom: promo !== undefined ? decalGeo(w, h, promo, t, true) : null, t }
    }
    const [w, h, t] = SIZE.K
    out.K2 = { body: out.K.body, top: decalGeo(w, h, 1, t, false), bottom: null, t }
    return out
  }, [])
}

const pieceWood = () =>
  cachedMaterial('shogi-piece-wood', () => {
    const m = M().woodLight.clone()
    m.color.setHex(0xf2d9a2)
    m.roughness = 0.42
    return m
  })
const glyphMat = () =>
  cachedMaterial('shogi-glyphs', () => new THREE.MeshStandardMaterial({ map: dynamicTexture('shogi-atlas', genPieceAtlas), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }))

/** Centre d'une case (repère local du plateau, dessus = 0). */
export function squareLocal(x: number, y: number): [number, number] {
  return [-BOARD.w / 2 + BOARD.margin + (x + 0.5) * BOARD.sqW, -BOARD.d / 2 + BOARD.margin + (y + 0.5) * BOARD.sqD]
}
function localToSquare(lx: number, lz: number): [number, number] {
  return [(lx + BOARD.w / 2 - BOARD.margin) / BOARD.sqW - 0.5, (lz + BOARD.d / 2 - BOARD.margin) / BOARD.sqD - 0.5]
}

function PieceMesh({ geos, type, owner, promoted, king2 = false, lift = 0, onClick }: { geos: Record<string, PieceGeos>; type: PieceType; owner: Side; promoted: boolean; king2?: boolean; lift?: number; onClick?: (e: ThreeEvent<PointerEvent>) => void }) {
  const g = king2 ? geos.K2 : geos[type]
  const flip = useRef<THREE.Group>(null)
  const target = promoted ? Math.PI : 0
  useFrame((_, dt) => {
    if (flip.current) {
      flip.current.rotation.z = damp(flip.current.rotation.z, target, 9, dt)
      const arc = Math.sin(Math.max(0, Math.min(1, flip.current.rotation.z / Math.PI)) * Math.PI) * 0.025
      flip.current.position.y = damp(flip.current.position.y, g.t / 2 + lift + arc, 14, dt)
    }
  })
  return (
    <group rotation={[0, owner === 0 ? 0 : Math.PI, 0]} onPointerDown={onClick}>
      <group ref={flip} position={[0, g.t / 2 + lift, 0]} rotation={[0, 0, target]}>
        <group position={[0, -g.t / 2, 0]}>
          <mesh geometry={g.body} material={pieceWood()} castShadow receiveShadow />
          <mesh geometry={g.top} material={glyphMat()} />
          {g.bottom && <mesh geometry={g.bottom} material={glyphMat()} />}
        </group>
      </group>
    </group>
  )
}

/** Pièce animée : glisse depuis sa case (ou la réserve) d'origine. */
function AnimatedPiece({ children, to, from }: { children: React.ReactNode; to: [number, number, number]; from?: [number, number, number] | null }) {
  const ref = useRef<THREE.Group>(null)
  const t = useRef(from ? 0 : 1)
  const start = useRef(from ?? to)
  useEffect(() => {
    if (from) {
      start.current = from
      t.current = 0
    }
  }, [from, to])
  useFrame((_, dt) => {
    if (!ref.current) return
    t.current = Math.min(1, t.current + dt * 3.2)
    const k = t.current * t.current * (3 - 2 * t.current)
    const [sx, sy, sz] = start.current
    ref.current.position.set(sx + (to[0] - sx) * k, sy + (to[1] - sy) * k + Math.sin(Math.PI * k) * 0.05, sz + (to[2] - sz) * k)
  })
  return (
    <group ref={ref} position={from ?? to}>
      {children}
    </group>
  )
}

function Komadai({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const m = M()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={m.woodMid} position={[0, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.025, 0.24]} />
      </mesh>
      <mesh material={m.woodMid} position={[0, 0.157, 0]}>
        <boxGeometry args={[0.2, 0.012, 0.2]} />
      </mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz])).map(([sx, sz], i) => (
        <mesh key={i} material={m.woodMid} position={[sx * 0.09, 0.065, sz * 0.09]}>
          <cylinderGeometry args={[0.014, 0.012, 0.13, 8]} />
        </mesh>
      ))}
    </group>
  )
}

const HAND_LAYOUT: Record<HandType, [number, number]> = { R: [-0.055, -0.06], B: [0.0, -0.06], G: [0.055, -0.06], S: [-0.055, 0.0], N: [0.0, 0.0], L: [0.055, 0.0], P: [0.0, 0.06] }

export function ShogiBoard3D({ interactive }: { interactive: boolean }) {
  const geos = usePieceGeos()
  const game = useShogi((s) => s.game)
  const mode = useShogi((s) => s.mode)
  const selected = useShogi((s) => s.selected)
  const targets = useShogi((s) => s.targets)
  const lastMove = useShogi((s) => s.lastMove)
  const strat = useShogi((s) => s.strat)
  const tool = useShogi((s) => s.tool)
  const arrowFrom = useShogi((s) => s.arrowFrom)
  const H = 0.27 // hauteur du dessus du plateau
  const m = M()

  const legs = useMemo(() => latheGeo([[0, 0], [0.04, 0], [0.05, 0.03], [0.036, 0.06], [0.044, 0.085], [0.03, 0.09], [0, 0.09]], 12), [])
  useEffect(() => () => legs.dispose(), [legs])

  const highlightMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x9a2a18, transparent: true, opacity: 0.8, depthWrite: false }), [])
  const lastMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x7a4a14, transparent: true, opacity: 0.28, depthWrite: false }), [])
  const dot = useMemo(() => new THREE.CircleGeometry(BOARD.sqW * 0.16, 20).rotateX(-Math.PI / 2), [])
  const selMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x6a3a10, transparent: true, opacity: 0.45, depthWrite: false }), [])
  const checkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.55, depthWrite: false }), [])
  const sq = useMemo(() => new THREE.PlaneGeometry(BOARD.sqW * 0.94, BOARD.sqD * 0.94).rotateX(-Math.PI / 2), [])

  const st = useShogi.getState
  const onBoard = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return
    e.stopPropagation()
    const local = (e.eventObject.parent ?? e.eventObject).worldToLocal(e.point.clone())
    const [fx, fy] = localToSquare(local.x, local.z)
    if (fx < -0.5 || fx > 8.5 || fy < -0.5 || fy > 8.5) return
    const s = st()
    if (s.mode === 'game') s.clickSquare(idx(Math.round(fx), Math.round(fy)))
    else if (s.tool !== 'move') s.stratClick(fx, fy)
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const s = st()
    if (!interactive || s.mode !== 'strategy' || !s.dragging) return
    const local = (e.eventObject.parent ?? e.eventObject).worldToLocal(e.point.clone())
    const [fx, fy] = localToSquare(local.x, local.z)
    s.movePiece(s.dragging, Math.max(-0.4, Math.min(8.4, fx)), Math.max(-0.4, Math.min(8.4, fy)))
  }
  const onUp = () => {
    const s = st()
    if (s.mode === 'strategy' && s.dragging) {
      const p = s.strat.pieces.find((x) => x.id === s.dragging)
      if (p) s.movePiece(p.id, p.x, p.y, true)
      s.patch({ dragging: null })
    }
  }

  // Positions précédentes pour animer le dernier coup
  const lastFrom = useMemo<[number, number, number] | null>(() => {
    if (!lastMove) return null
    if (lastMove.drop) {
      const side = game.turn === 0 ? 1 : 0
      return side === 0 ? [BOARD.w / 2 + 0.2, 0.17, BOARD.d / 2 - 0.15] : [-BOARD.w / 2 - 0.2, 0.17, -BOARD.d / 2 + 0.15]
    }
    const [x, y] = xy(lastMove.from!)
    const [lx, lz] = squareLocal(x, y)
    return [lx, H, lz]
  }, [lastMove, game.turn])

  const checkSq = useMemo(() => (inCheck(game) ? findKing(game.board, game.turn) : -1), [game])

  return (
    <group>
      {/* Goban */}
      <mesh material={m.woodLight} position={[0, (H - 0.09) / 2 + 0.09, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD.w, H - 0.09, BOARD.d]} />
      </mesh>
      <mesh material={shogiBoardMat()} position={[0, H + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BOARD.w, BOARD.d]} />
      </mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz])).map(([sx, sz], i) => (
        <mesh key={i} geometry={legs} material={m.woodLight} position={[sx * (BOARD.w / 2 - 0.07), 0, sz * (BOARD.d / 2 - 0.07)]} />
      ))}
      {/* surface cliquable */}
      <mesh position={[0, H + 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onBoard} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <planeGeometry args={[BOARD.w + 0.06, BOARD.d + 0.06]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Komadai position={[BOARD.w / 2 + 0.2, 0, BOARD.d / 2 - 0.15]} />
      <Komadai position={[-BOARD.w / 2 - 0.2, 0, -BOARD.d / 2 + 0.15]} rotation={Math.PI} />

      {mode === 'game' ? (
        <>
          {/* surbrillances */}
          {lastMove && !lastMove.drop && <mesh geometry={sq} material={lastMat} position={[...withY(squareLocal(...xy(lastMove.from!)), H + 0.001)]} />}
          {lastMove && <mesh geometry={sq} material={lastMat} position={[...withY(squareLocal(...xy(lastMove.to)), H + 0.001)]} />}
          {selected?.kind === 'board' && <mesh geometry={sq} material={selMat} position={[...withY(squareLocal(...xy(selected.sq)), H + 0.0015)]} />}
          {checkSq >= 0 && <mesh geometry={sq} material={checkMat} position={[...withY(squareLocal(...xy(checkSq)), H + 0.0015)]} />}
          {targets.map((t) => (
            <mesh key={t} geometry={game.board[t] ? sq : dot} material={highlightMat} position={[...withY(squareLocal(...xy(t)), H + 0.002)]} scale={game.board[t] ? [1, 1, 1] : [1, 1, 1]} />
          ))}
          {/* pièces sur le plateau */}
          {game.board.map((p, i) => {
            if (!p) return null
            const [x, y] = xy(i)
            const [lx, lz] = squareLocal(x, y)
            const isLast = lastMove?.to === i
            return (
              <AnimatedPiece key={`${i}-${isLast ? game.ply : 0}`} to={[lx, H, lz]} from={isLast ? lastFrom : null}>
                <PieceMesh
                  geos={geos}
                  type={p.type}
                  owner={p.owner}
                  promoted={p.promoted}
                  king2={p.type === 'K' && p.owner === 1}
                  lift={selected?.kind === 'board' && selected.sq === i ? 0.012 : 0}
                  onClick={(e) => {
                    if (!interactive) return
                    e.stopPropagation()
                    useShogi.getState().clickSquare(i)
                  }}
                />
              </AnimatedPiece>
            )
          })}
          {/* réserves */}
          {([0, 1] as Side[]).map((side) =>
            handList(game, side).map(({ type, count }) => {
              const [hx, hz] = HAND_LAYOUT[type]
              const base: [number, number, number] = side === 0 ? [BOARD.w / 2 + 0.2 + hx, 0.163, BOARD.d / 2 - 0.15 + hz] : [-BOARD.w / 2 - 0.2 - hx, 0.163, -BOARD.d / 2 + 0.15 - hz]
              const sel = selected?.kind === 'hand' && selected.type === type && game.turn === side
              return Array.from({ length: Math.min(count, 6) }, (_, k) => (
                <group key={`${side}-${type}-${k}`} position={[base[0] + (side ? -1 : 1) * k * 0.004, base[1] + k * 0.002, base[2] + (side ? 1 : -1) * k * 0.006]}>
                  <PieceMesh
                    geos={geos}
                    type={type}
                    owner={side}
                    promoted={false}
                    lift={sel ? 0.015 : 0}
                    onClick={(e) => {
                      if (!interactive) return
                      e.stopPropagation()
                      useShogi.getState().selectHand(type, side)
                    }}
                  />
                </group>
              )).concat(
                count > 1 ? (
                  <Html key={`${side}-${type}-n`} position={[base[0] + (side ? -0.022 : 0.022), base[1] + 0.02, base[2]]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                    <span className="rounded bg-ink/80 px-1 font-serif text-[11px] text-amber">×{count}</span>
                  </Html>
                ) : (
                  []
                ),
              )
            }),
          )}
        </>
      ) : (
        <StrategyLayer geos={geos} H={H} interactive={interactive} tool={tool} arrowFrom={arrowFrom} strat={strat} />
      )}
    </group>
  )
}

const withY = ([x, z]: [number, number], y: number): [number, number, number] => [x, y, z]

function arrowGeo(from: [number, number], to: [number, number]) {
  const [ax, az] = squareLocal(from[0], from[1])
  const [bx, bz] = squareLocal(to[0], to[1])
  const len = Math.hypot(bx - ax, bz - az)
  const s = new THREE.Shape()
  const w = 0.006
  const hw = 0.016
  const hl = 0.022
  s.moveTo(0, -w)
  s.lineTo(len - hl, -w)
  s.lineTo(len - hl, -hw)
  s.lineTo(len, 0)
  s.lineTo(len - hl, hw)
  s.lineTo(len - hl, w)
  s.lineTo(0, w)
  s.closePath()
  const g = new THREE.ShapeGeometry(s)
  g.rotateX(-Math.PI / 2)
  g.rotateY(-Math.atan2(bz - az, bx - ax))
  g.translate(ax, 0, az)
  return g
}

function StrategyLayer({ geos, H, interactive, tool, arrowFrom, strat }: { geos: Record<string, PieceGeos>; H: number; interactive: boolean; tool: string; arrowFrom: [number, number] | null; strat: ReturnType<typeof useShogi.getState>['strat'] }) {
  const arrows = useMemo(() => strat.arrows.map((a) => ({ id: a.id, color: a.color, geo: arrowGeo(a.from, a.to) })), [strat.arrows])
  useEffect(() => () => arrows.forEach((a) => a.geo.dispose()), [arrows])
  const startDrag = (p: StrategyPiece) => (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || tool !== 'move') return
    e.stopPropagation()
    useShogi.getState().patch({ dragging: p.id })
  }
  return (
    <group>
      {strat.pieces.map((p) => {
        const [lx, lz] = squareLocal(p.x, p.y)
        const drag = useShogi.getState().dragging === p.id
        return (
          <group key={p.id} position={[lx, H + (drag ? 0.02 : 0), lz]} onPointerDown={startDrag(p)}>
            <PieceMesh geos={geos} type={p.type as PieceType} owner={p.side} promoted={p.promoted} king2={p.type === 'K' && p.side === 1} />
          </group>
        )
      })}
      {strat.markers.map((mk) => {
        const [lx, lz] = squareLocal(mk.x, mk.y)
        return (
          <mesh key={mk.id} position={[lx, H + 0.006, lz]}>
            <cylinderGeometry args={[0.012, 0.014, 0.012, 16]} />
            <meshStandardMaterial color={mk.color} roughness={0.4} emissive={mk.color} emissiveIntensity={0.25} />
          </mesh>
        )
      })}
      {arrows.map((a) => (
        <mesh key={a.id} geometry={a.geo} position={[0, H + 0.004, 0]}>
          <meshBasicMaterial color={a.color} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {arrowFrom && (
        <mesh position={[...withY(squareLocal(arrowFrom[0], arrowFrom[1]), H + 0.003)]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.012, 0.018, 24]} />
          <meshBasicMaterial color="#ffd08a" />
        </mesh>
      )}
      {strat.notes.map((n) => {
        const [lx, lz] = squareLocal(n.x, n.y)
        return (
          <Html key={n.id} position={[lx, H + 0.03, lz]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div className="max-w-[140px] rounded-sm border border-amber/40 bg-[#e6dcc3] px-2 py-1 font-serif text-[11px] leading-tight text-ink shadow-lg">{n.text}</div>
          </Html>
        )
      })}
    </group>
  )
}
