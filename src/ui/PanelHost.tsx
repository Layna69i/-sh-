import { AnimatePresence } from 'motion/react'
import { lazy, Suspense, type ComponentType } from 'react'
import { useGame, type PanelId } from '../store/game'
import { audio } from '../audio/engine'
import { PanelFrame } from './PanelFrame'

export interface PanelProps {
  close: () => void
  params?: Record<string, string | number | boolean | undefined>
}

const PANELS: Partial<Record<PanelId, ComponentType<PanelProps>>> = {
  presentation: lazy(() => import('./panels/PresentationPanel')),
  announcements: lazy(() => import('./panels/AnnouncementsPanel')),
  map: lazy(() => import('./panels/MapPanel')),
  archives: lazy(() => import('./panels/ArchivesPanel')),
  shogi: lazy(() => import('./panels/ShogiPanel')),
  courses: lazy(() => import('./panels/CoursesPanel')),
  missions: lazy(() => import('./panels/MissionsPanel')),
  council: lazy(() => import('./panels/CouncilPanel')),
  notebook: lazy(() => import('./panels/NotebookPanel')),
  recruitment: lazy(() => import('./panels/RecruitmentPanel')),
  garden: lazy(() => import('./panels/GardenPanel')),
  settings: lazy(() => import('./panels/SettingsPanel')),
  auth: lazy(() => import('./panels/AuthPanel')),
  help: lazy(() => import('./panels/HelpPanel')),
}

function Loading({ close }: { close: () => void }) {
  return (
    <PanelFrame title="…" onClose={close}>
      <p className="italic text-paper-2">Le parchemin se déroule…</p>
    </PanelFrame>
  )
}

export function PanelHost() {
  const panel = useGame((s) => s.panel)
  const closePanel = useGame((s) => s.closePanel)
  const close = () => {
    closePanel()
    audio.ui('close')
  }
  const Comp = panel ? PANELS[panel.id] : undefined
  return (
    <AnimatePresence>
      {panel && Comp && (
        <Suspense key={panel.id + JSON.stringify(panel.params ?? {})} fallback={<Loading close={close} />}>
          <Comp close={close} params={panel.params} />
        </Suspense>
      )}
    </AnimatePresence>
  )
}
