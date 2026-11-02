import { Suspense, useEffect, useState } from 'react'
import MusiqueFond from "./MusiqueFond";
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import './world/shaderTweaks'
import { World } from './world/World'
import { loadAssets } from './world/assets'
import { useGame } from './store/game'
import { useSettings, QUALITY, renderDpr } from './store/settings'
import { initData } from './data/session'
import { audio } from './audio/engine'
import { LoadingScreen } from './ui/LoadingScreen'
import { IntroOverlay } from './ui/IntroOverlay'
import { HUD } from './ui/HUD'
import { PanelHost } from './ui/PanelHost'
import { Toasts } from './ui/Toasts'
import { TouchControls } from './ui/TouchControls'
import { InkTransition } from './ui/InkTransition'

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function App() {
  const [assetsOk, setAssetsOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const quality = useSettings((s) => s.quality)
  const Q = QUALITY[quality]
  const [dpr, setDpr] = useState(() => renderDpr(Q, 1))

  useEffect(() => {
    void initData()
    if (!webglAvailable()) {
      setError('WebGL n’est pas disponible sur ce navigateur ou cet appareil. Activez l’accélération matérielle ou essayez un navigateur récent.')
      return
    }
    loadAssets(useSettings.getState().quality, (p, label) => useGame.getState().setLoad(p * 0.88, label))
      .then(() => setAssetsOk(true))
      .catch((e) => setError(`Impossible de préparer le domaine : ${e instanceof Error ? e.message : String(e)}`))
  }, [])

  useEffect(() => setDpr(renderDpr(Q, 1)), [Q])

  useEffect(() => {
  const appliquer = (s) => audio.setVolumes({ master: 0, ambience: s.ambience, music: s.music, muted: s.muted })
  appliquer(useSettings.getState())
  return useSettings.subscribe(appliquer)
}, [])

  return (
    <div className="fixed inset-0 bg-ink">
      <MusiqueFond />
      {assetsOk && (
        <Canvas
          key={quality}
          shadows={Q.shadows ? 'soft' : false}
          dpr={dpr}
          gl={{ antialias: Q.antialias && !Q.bloom, powerPreference: 'high-performance', toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.0 }}
          camera={{ fov: 62, near: 0.05, far: 2000, position: [-26, 22, 104] }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x07080a)
          }}
        >
          <PerformanceMonitor
            onChange={({ factor }) => setDpr(renderDpr(Q, factor))}
            flipflops={3}
            onFallback={() => setDpr(renderDpr(Q, 0))}
          />
          <Suspense fallback={null}>
            <World />
          </Suspense>
        </Canvas>
      )}
      <HUD />
      <PanelHost />
      <InkTransition />
      <TouchControls />
      <Toasts />
      <IntroOverlay />
      <LoadingScreen error={error} />
    </div>
  )
}
