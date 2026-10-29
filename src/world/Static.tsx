import { useEffect, useMemo } from 'react'
import { StaticBuilder, type StaticPart } from './geo'

export function StaticMeshes({ parts }: { parts: StaticPart[] }) {
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts])
  return (
    <>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={p.material} castShadow={p.cast} receiveShadow={p.receive} />
      ))}
    </>
  )
}

/** Construit (une fois) un décor statique fusionné par matériau. */
export function useStatic(build: (b: StaticBuilder) => void, deps: unknown[] = [], defaults?: { cast: boolean; receive: boolean }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    const b = new StaticBuilder(defaults)
    build(b)
    return b.build()
  }, deps)
}

export function Static({ build, deps = [], cast = false }: { build: (b: StaticBuilder) => void; deps?: unknown[]; cast?: boolean }) {
  const parts = useStatic(build, deps, { cast, receive: true })
  return <StaticMeshes parts={parts} />
}
