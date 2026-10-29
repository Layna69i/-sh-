/**
 * Racine de la scène 3D. Les pièces ne sont affichées que si elles sont
 * visibles depuis la zone courante (portails grossiers) : la scène entière
 * reste montée (collisions, interactions), seul le rendu est filtré.
 */
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGame } from '../store/game'
import { Lighting } from './Lighting'
import { ZoneGroup } from './ZoneGroup'
import { Sky, Mountains } from './exterior/Sky'
import { Forest } from './exterior/Forest'
import { Domain } from './exterior/Domain'
import { Atmosphere } from './exterior/Atmosphere'
import { Waterfall } from './exterior/Waterfall'
import { Gardens } from './exterior/Gardens'
import { Shell } from './building/Shell'
import { Doors } from './building/Doors'
import { Crown } from './building/Crown'
import { Rooms } from './rooms/Rooms'
import { PlayerController } from '../player/PlayerController'
import { InteractionSystem } from '../interaction/InteractionSystem'
import { IntroCamera } from './IntroCamera'
import { ShadowGuide } from './effects/ShadowGuide'
import { PostFX } from './PostFX'

/** Précompile les shaders de toute la scène avant de révéler l'expérience. */
function Warmup() {
  const { gl, scene, camera } = useThree()
  const frames = useRef(0)
  const [done, setDone] = useState(false)
  useFrame(() => {
    if (done) return
    frames.current++
    if (frames.current === 3) {
      const r = gl as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<void> }
      const p = r.compileAsync ? r.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera))
      Promise.resolve(p)
        .catch(() => undefined)
        .then(() => {
          setDone(true)
          useGame.getState().setLoad(1, 'Le domaine vous attend')
          window.setTimeout(() => {
            const g = useGame.getState()
            g.setWorldReady()
            if (g.phase === 'loading') g.setPhase('intro')
          }, 350)
        })
    }
  })
  return null
}

function DebugExpose() {
  const { scene, gl, camera } = useThree()
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign((window as unknown as { __osho: object }).__osho ?? {}, { scene, gl, camera })
  }, [scene, gl, camera])
  return null
}

export function World() {
  const setLoad = useGame((s) => s.setLoad)
  useEffect(() => setLoad(0.9, 'Allumage des lanternes'), [setLoad])
  return (
    <>
      <Lighting />
      <Sky />
      <Mountains />
      <ZoneGroup zone="exterior">
        <Forest />
        <Atmosphere />
        <Waterfall />
        <Gardens />
      </ZoneGroup>
      <Domain />
      <Shell />
      <Crown />
      <Doors />
      <Rooms />
      <PlayerController />
      <InteractionSystem />
      <IntroCamera />
      <ShadowGuide />
      <PostFX />
      <Warmup />
      {import.meta.env.DEV && <DebugExpose />}
    </>
  )
}
