import { create } from 'zustand'
import type { Repository } from './repository'
import { useVersions } from './repository'
import { VISITOR, type Session, type Permission } from './types'
import { createLocalRepository } from './localRepository'
import { readFirebaseConfig, createFirebaseRepository } from './firebaseRepository'

interface SessionStore {
  session: Session
  repo: Repository | null
  mode: 'loading' | 'local' | 'firebase'
  fallbackReason: string | null
}

export const useSession = create<SessionStore>(() => ({ session: VISITOR, repo: null, mode: 'loading', fallbackReason: null }))

export const repo = () => {
  const r = useSession.getState().repo
  if (!r) throw new Error('Données non initialisées.')
  return r
}

export const useCan = (p: Permission) => useSession((s) => s.session.perms.includes(p))

let started = false
export async function initData() {
  if (started) return
  started = true
  const cfg = readFirebaseConfig()
  let r: Repository
  let fallbackReason: string | null = null
  if (cfg) {
    try {
      r = await createFirebaseRepository(cfg)
    } catch (e) {
      console.error('[Ōshō] Firebase indisponible, bascule en mode local.', e)
      fallbackReason = 'Firebase est configuré mais n’a pas pu être initialisé : mode démonstration local activé.'
      r = createLocalRepository()
    }
  } else r = createLocalRepository()
  useSession.setState({ repo: r, mode: r.mode, fallbackReason })
  r.onSession((session) => {
    useSession.setState({ session })
    useVersions.getState().bump('__session')
  })
}

/** Exécute une écriture, invalide les clés et renvoie un message d'erreur lisible. */
export async function mutate(keys: string[], fn: (r: Repository) => Promise<unknown>): Promise<string | null> {
  try {
    await fn(repo())
    useVersions.getState().bump(...keys)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
