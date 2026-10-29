import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/shippori-mincho/500.css'
import '@fontsource/shippori-mincho/800.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/eb-garamond/500-italic.css'
import '@fontsource/eb-garamond/600.css'
import './index.css'
import App from './App'
import { useGame } from './store/game'
import { useSettings } from './store/settings'
import { intro } from './world/IntroCamera'
import { player } from './player/PlayerController'
import { triggerInteraction, getCurrentTarget } from './interaction/InteractionSystem'
import { useShogi } from './shogi/store'
import { useSession, repo } from './data/session'

// Accès de débogage (développement uniquement)
if (import.meta.env.DEV)
  Object.assign(window, {
    __osho: {
      game: useGame,
      settings: useSettings,
      intro,
      player,
      interact: triggerInteraction,
      target: () => getCurrentTarget()?.id,
      shogi: useShogi,
      session: useSession,
      repo,
      /** Place la caméra (x, z, cap, inclinaison) dès que le monde est prêt. */
      go(x: number, z: number, yaw = 0, pitch = 0, doors = true) {
        const apply = () => {
          const g = useGame.getState()
          if (!g.worldReady) return void setTimeout(apply, 300)
          if (doors) for (const id of Object.keys(g.doors)) g.setDoor(id, true)
          g.setPhase('playing')
          useGame.setState({ pointerLocked: true })
          useSettings.getState().set({ hints: false })
          Object.assign(player, { x, z, yaw, pitch })
        }
        apply()
      },
    },
  })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
