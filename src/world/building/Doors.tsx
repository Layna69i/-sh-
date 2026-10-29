/**
 * Portes réellement fonctionnelles : grande porte à deux battants pivotants,
 * fusuma et shoji coulissants. Le collisionneur de la porte n'est désactivé
 * qu'une fois l'ouverture suffisante. Chaque porte porte une plaque indiquant
 * la salle à laquelle elle mène.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { DOORS, ROOM_BY_ID, WALL_T, type DoorDef, type ZoneId } from '../layout'
import { M, T, cachedMaterial, dynamicTexture } from '../assets'
import { useGame } from '../../store/game'
import { setColliderEnabled } from '../../player/collision'
import { useInteractable } from '../../interaction/useInteractable'
import { boxAt } from '../../interaction/registry'
import { audio } from '../../audio/engine'
import { damp } from '../../core/math'
import { makeCanvas, ctx2d, normalFromHeight, toTexture, JP_FONT, LATIN_FONT } from '../../textures/util'
import { drawEmblem } from '../../textures/generators'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { boxGeo, materialBox } from '../geo'

function plaqueMat(zone: ZoneId) {
  return cachedMaterial(`plaque-${zone}`, () => {
    const tex = dynamicTexture(`plaque-${zone}`, () => {
      const c = makeCanvas(512, 150)
      const ctx = ctx2d(c)
      const g = ctx.createLinearGradient(0, 0, 0, 150)
      g.addColorStop(0, '#2a1f18')
      g.addColorStop(1, '#17110d')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 512, 150)
      ctx.strokeStyle = '#9c7a44'
      ctx.lineWidth = 5
      ctx.strokeRect(8, 8, 496, 134)
      const r = zone === 'exterior' ? null : ROOM_BY_ID[zone]
      ctx.fillStyle = '#d4ab62'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = `800 64px ${JP_FONT}`
      ctx.fillText(r ? r.kanji : '奈良の森', 30, 66)
      ctx.font = `600 22px ${LATIN_FONT}`
      ctx.fillStyle = '#cdbf9f'
      ctx.textAlign = 'right'
      ctx.fillText(r ? r.ordinal + ' · ' + r.short : 'Forêt', 482, 112)
      return c
    })
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 })
  })
}

const EMBLEM_D = 1.9
/** médaillon de laque qui porte l'emblème (un peu plus grand que lui) */
const ROUNDEL_R = EMBLEM_D / 2 + 0.09

/** Emblème doré en relief : découpe nette (alphaTest), relief tiré d'une hauteur adoucie. */
function gateLeafMat() {
  return cachedMaterial('gate-emblem-gold', () => {
    const tex = dynamicTexture('gate-emblem', () => {
      const c = makeCanvas(1024)
      const ctx = ctx2d(c)
      ctx.clearRect(0, 0, 1024, 1024)
      drawEmblem(ctx, 512, 512, 460, '#ffffff')
      return c
    })
    // relief : la même découpe, adoucie, devient une carte de hauteur (bords biseautés)
    const h = makeCanvas(512)
    const hx = ctx2d(h)
    hx.fillStyle = '#000'
    hx.fillRect(0, 0, 512, 512)
    hx.filter = 'blur(3px)'
    drawEmblem(hx, 256, 256, 230, '#ffffff')
    const px = hx.getImageData(0, 0, 512, 512).data
    const hm = new Float32Array(512 * 512)
    for (let i = 0; i < hm.length; i++) hm[i] = px[i * 4] / 255
    const normal = toTexture(normalFromHeight(hm, 512, 512, 5), { srgb: false, repeat: false })
    return new THREE.MeshStandardMaterial({
      color: 0xd2a75c,
      map: tex,
      alphaTest: 0.5,
      normalMap: normal,
      normalScale: new THREE.Vector2(1, -1),
      metalness: 1,
      roughness: 0.32,
      envMapIntensity: 1.1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  })
}

const lacquer = () => cachedMaterial('gate-lacquer', () => new THREE.MeshStandardMaterial({ color: 0x120e0c, roughness: 0.22, metalness: 0, envMapIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }))

/** Fusion par matériau (moins d'appels de dessin pour chaque battant). */
function mergeByMaterial(parts: { geo: THREE.BufferGeometry; mat: THREE.Material; pos: [number, number, number]; rot?: [number, number, number] }[]) {
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>()
  for (const p of parts) {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()) as THREE.BufferGeometry
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    if (p.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...p.rot)))
    g.translate(...p.pos)
    groups.set(p.mat, [...(groups.get(p.mat) ?? []), g])
    p.geo.dispose()
  }
  return [...groups].map(([mat, list]) => {
    const geo = mergeGeometries(list, false)!
    list.forEach((g) => g.dispose())
    return { geo, mat }
  })
}

/**
 * Grande porte : battants de planches jointes sur traverses chanfreinées, clous en demi-sphère
 * sur rondelles, platines de bronze aux extrémités des traverses, anneaux de tirage près de la
 * jonction ; au centre, l'emblème doré en relief sur un médaillon de laque noire cerclé d'or.
 */
function Gate({ d }: { d: DoorDef }) {
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const open = useRef(0)
  const hw = d.width / 2
  const m = M()
  const leaf = useMemo(() => {
    type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; pos: [number, number, number]; rot?: [number, number, number] }
    const parts: Part[] = []
    const lw = hw - 0.02
    const seamX = hw - 0.01
    const roundelY = 2.1
    parts.push({ geo: materialBox(m.woodDark, lw, d.height - 0.04, 0.16), mat: m.woodDark, pos: [hw / 2, d.height / 2, 0] })
    // joints des planches (côté rue et côté hall)
    for (let x = 0.3; x < lw - 0.1; x += 0.3)
      for (const z of [0.081, -0.081]) parts.push({ geo: new THREE.BoxGeometry(0.012, d.height - 0.1, 0.004), mat: m.woodBlack, pos: [x, d.height / 2, z] })
    const rails = [0.4, 1.3, 2.3, 3.3]
    for (const y of rails)
      for (const z of [0.1, -0.1]) {
        parts.push({ geo: materialBox(m.woodBlack, hw - 0.08, 0.14, 0.06), mat: m.woodBlack, pos: [hw / 2, y, z] })
        // platines de bronze aux deux bouts de la traverse
        for (const x of [0.12, hw - 0.12]) {
          if (z > 0 && Math.hypot(seamX - x, roundelY - y) < ROUNDEL_R + 0.1) continue
          parts.push({ geo: new THREE.BoxGeometry(0.16, 0.18, 0.008), mat: m.bronze, pos: [x, y, z + Math.sign(z) * 0.033] })
        }
      }
    // clous : demi-sphères sur rondelles (hors du médaillon)
    for (const y of rails)
      for (let i = 0; i < 4; i++) {
        const x = 0.25 + i * ((hw - 0.5) / 3)
        if (Math.hypot(seamX - x, roundelY - y) < ROUNDEL_R + 0.06) continue
        parts.push({ geo: new THREE.SphereGeometry(0.036, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat: m.bronze, pos: [x, y, 0.13], rot: [Math.PI / 2, 0, 0] })
        parts.push({ geo: new THREE.CylinderGeometry(0.052, 0.052, 0.006, 14), mat: m.bronze, pos: [x, y, 0.132], rot: [Math.PI / 2, 0, 0] })
      }
    // anneau de tirage (kan) suspendu à sa platine ronde
    parts.push({ geo: new THREE.CylinderGeometry(0.075, 0.075, 0.01, 18), mat: m.bronze, pos: [seamX - 0.2, 0.95, 0.085], rot: [Math.PI / 2, 0, 0] })
    parts.push({ geo: new THREE.TorusGeometry(0.1, 0.013, 8, 24), mat: m.bronze, pos: [seamX - 0.2, 0.86, 0.1] })
    return mergeByMaterial(parts)
  }, [hw, d.height, m])
  // médaillon : demi-disque de laque et demi-filet doré par battant (la jonction passe au centre)
  const roundel = useMemo(() => {
    const disc = new THREE.CircleGeometry(ROUNDEL_R, 64, Math.PI / 2, Math.PI)
    const ring = new THREE.RingGeometry(ROUNDEL_R - 0.035, ROUNDEL_R, 64, 1, Math.PI / 2, Math.PI)
    return { disc, ring }
  }, [])
  // emblème rond de 1,9 m partagé entre les deux battants : chacun en porte une moitié
  const emblemGeoL = useMemo(() => {
    const g = new THREE.PlaneGeometry(EMBLEM_D / 2, EMBLEM_D)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5)
    return g
  }, [])
  const emblemGeoR = useMemo(() => {
    const g = new THREE.PlaneGeometry(EMBLEM_D / 2, EMBLEM_D)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setX(i, 0.5 + uv.getX(i) * 0.5)
    return g
  }, [])
  const emblemX = hw - EMBLEM_D / 4 - 0.01

  useFrame((_, dt) => {
    const target = useGame.getState().doors[d.id] ? 1 : 0
    open.current = damp(open.current, target, 1.6, dt)
    const a = open.current * 1.55
    if (left.current) left.current.rotation.y = a
    if (right.current) right.current.rotation.y = -a
    setColliderEnabled(`door:${d.id}`, open.current < 0.55)
  })
  const medallion = (
    <>
      <mesh geometry={roundel.disc} material={lacquer()} position={[hw - 0.01, 2.1, 0.134]} receiveShadow />
      <mesh geometry={roundel.ring} material={m.gold} position={[hw - 0.01, 2.1, 0.1345]} />
    </>
  )
  return (
    <group position={[d.center, 0, d.at]}>
      <group ref={left} position={[-hw, 0, 0]}>
        {leaf.map((p, i) => (
          <mesh key={i} geometry={p.geo} material={p.mat} castShadow receiveShadow />
        ))}
        {medallion}
        <mesh geometry={emblemGeoL} material={gateLeafMat()} position={[emblemX, 2.1, 0.136]} receiveShadow />
      </group>
      <group ref={right} position={[hw, 0, 0]} scale={[-1, 1, 1]}>
        {leaf.map((p, i) => (
          <mesh key={i} geometry={p.geo} material={p.mat} castShadow receiveShadow />
        ))}
        {medallion}
        <mesh geometry={emblemGeoR} material={gateLeafMat()} position={[emblemX, 2.1, 0.136]} scale={[-1, 1, 1]} receiveShadow />
      </group>
    </group>
  )
}

function Sliding({ d }: { d: DoorDef }) {
  const a = useRef<THREE.Group>(null)
  const b = useRef<THREE.Group>(null)
  const open = useRef(0)
  const pw = d.width / 2 + 0.02
  const m = M()
  const inner = d.kind === 'shoji' ? m.shoji : d.id.length % 2 ? m.fusuma1 : m.fusuma2
  const panel = useMemo(() => {
    const frame = d.kind === 'shoji' ? m.woodDark : m.woodBlack
    return [
      { geo: boxGeo(0.05, d.height, 0.05), mat: frame, pos: [-pw / 2 + 0.025, d.height / 2, 0] },
      { geo: boxGeo(0.05, d.height, 0.05), mat: frame, pos: [pw / 2 - 0.025, d.height / 2, 0] },
      { geo: boxGeo(pw, 0.06, 0.05), mat: frame, pos: [0, d.height - 0.03, 0] },
      { geo: boxGeo(pw, 0.08, 0.05), mat: frame, pos: [0, 0.04, 0] },
    ] as { geo: THREE.BufferGeometry; mat: THREE.Material; pos: [number, number, number] }[]
  }, [d, pw, m])
  const pane = useMemo(() => new THREE.PlaneGeometry(pw - 0.08, d.height - 0.12), [pw, d.height])

  useFrame((_, dt) => {
    const target = useGame.getState().doors[d.id] ? 1 : 0
    open.current = damp(open.current, target, 3.2, dt)
    const s = open.current * (pw - 0.06)
    if (a.current) a.current.position.x = -pw / 2 - s
    if (b.current) b.current.position.x = pw / 2 + s
    setColliderEnabled(`door:${d.id}`, open.current < 0.6)
  })
  const rotY = d.axis === 'x' ? 0 : Math.PI / 2
  const pos: [number, number, number] = d.axis === 'x' ? [d.center, 0, d.at] : [d.at, 0, d.center]
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {[a, b].map((ref, k) => (
        <group key={k} ref={ref} position={[k ? pw / 2 : -pw / 2, 0, k ? 0.035 : -0.035]}>
          {panel.map((p, i) => (
            <mesh key={i} geometry={p.geo} material={p.mat} position={p.pos} castShadow />
          ))}
          <mesh geometry={pane} material={inner} position={[0, d.height / 2 + 0.01, 0]} />
          <mesh geometry={pane} material={inner} position={[0, d.height / 2 + 0.01, 0]} rotation={[0, Math.PI, 0]} />
        </group>
      ))}
    </group>
  )
}

function Plaques({ d }: { d: DoorDef }) {
  const items = useMemo(() => {
    const list: { pos: [number, number, number]; rot: number; mat: THREE.Material }[] = []
    const [neg, pos] = d.rooms
    const y = d.height + (d.kind === 'gate' ? 0.55 : 0.32)
    // côté négatif : la plaque annonce la pièce du côté positif, et inversement
    for (const [side, from, to] of [
      [-1, neg, pos],
      [1, pos, neg],
    ] as const) {
      if (from === 'exterior' && d.kind !== 'gate') continue
      if (d.kind === 'gate' && from === 'hall') continue
      const off = side * (WALL_T / 2 + 0.03)
      const p: [number, number, number] = d.axis === 'x' ? [d.center, y, d.at + off] : [d.at + off, y, d.center]
      const rot = d.axis === 'x' ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2
      list.push({ pos: p, rot, mat: plaqueMat(to) })
    }
    return list
  }, [d])
  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} position={it.pos} rotation={[0, it.rot, 0]} material={it.mat}>
          <planeGeometry args={d.kind === 'gate' ? [1.7, 0.5] : [1.05, 0.31]} />
        </mesh>
      ))}
    </>
  )
}

function Door({ d }: { d: DoorDef }) {
  const zones = d.rooms.filter((z) => z !== 'exterior') as ZoneId[]
  if (d.rooms.includes('exterior')) zones.push('exterior')
  useInteractable(
    () => ({
      id: `door-${d.id}`,
      zone: zones[0],
      zones,
      get label() {
        return `${useGame.getState().doors[d.id] ? 'Fermer' : 'Ouvrir'} — ${d.label}`
      },
      verb: 'Porte',
      box: d.axis === 'x' ? boxAt(d.center, d.height / 2, d.at, d.width, d.height, 0.6) : boxAt(d.at, d.height / 2, d.center, 0.6, d.height, d.width),
      maxDist: 3.4,
      onInteract: () => {
        const g = useGame.getState()
        const next = !g.doors[d.id]
        g.setDoor(d.id, next)
        audio.door(d.kind === 'window' ? 'shoji' : d.kind, next)
      },
    }),
    [d.id],
  )
  return (
    <>
      {d.kind === 'gate' ? <Gate d={d} /> : <Sliding d={d} />}
      <Plaques d={d} />
    </>
  )
}

export function Doors() {
  // Préchauffe la texture shoji (évite un à-coup à la première ouverture)
  void T().shoji
  return (
    <>
      {DOORS.filter((d) => d.kind !== 'window').map((d) => (
        <Door key={d.id} d={d} />
      ))}
    </>
  )
}
