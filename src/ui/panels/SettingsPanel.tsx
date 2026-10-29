/** Réglages : qualité graphique, contrôles, audio, données de démonstration. */
import { useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { Field, SectionTitle, ConfirmButton, SuccessNote, ErrorNote, Pill } from '../kit'
import { useSettings, QUALITY, type Quality } from '../../store/settings'
import { loadedTier } from '../../world/pbr'
import { useSession, repo, mutate } from '../../data/session'
import { can } from '../../data/types'
import { useVersions } from '../../data/repository'

function Range({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <Field label={`${label} — ${format ? format(value) : value}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#d3a15b]" />
    </Field>
  )
}

export default function SettingsPanel({ close }: PanelProps) {
  const s = useSettings()
  const mode = useSession((x) => x.mode)
  const fallback = useSession((x) => x.fallbackReason)
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const canSeed = useSession((x) => can(x.session, 'ranks.manage'))
  return (
    <PanelFrame title="Réglages" kanji="設定" onClose={close} width="md">
      <SectionTitle kanji="画">Graphismes</SectionTitle>
      <Field
        label="Qualité"
        hint="Bas : sans ombres ni post-traitement, textures procédurales légères, rendu à 85–100 % de la définition de l’écran (mobiles). Moyen : textures photographiques 1K, ombres, SMAA qualité haute, accentuation, jamais sous la définition native. Élevé : textures 2K, ombres 4K, occlusion ambiante, MSAA 4× et suréchantillonnage jusqu’à 2×, accentuation légère."
      >
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(QUALITY) as Quality[]).map((q) => (
            <button key={q} className={`btn-ink ${s.quality === q ? 'primary' : ''}`} onClick={() => s.set({ quality: q })}>
              {QUALITY[q].label}
            </button>
          ))}
        </div>
        {QUALITY[s.quality].textures !== loadedTier() && (
          <p className="mt-2 flex items-center gap-3 text-sm text-paper-3">
            Les textures de ce profil seront chargées au prochain démarrage.
            <button className="btn-ink" onClick={() => window.location.reload()}>
              Recharger
            </button>
          </p>
        )}
      </Field>
      <div className="mt-3 space-y-3">
        <Range label="Champ de vision" value={s.fov} min={55} max={85} step={1} onChange={(v) => s.set({ fov: v })} format={(v) => `${v}°`} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.headBob} onChange={(e) => s.set({ headBob: e.target.checked })} /> Balancement de la marche
        </label>
      </div>
      <SectionTitle kanji="操">Contrôles</SectionTitle>
      <div className="space-y-3">
        <Range label="Sensibilité de la souris" value={s.sensitivity} min={0.3} max={2.5} step={0.05} onChange={(v) => s.set({ sensitivity: v })} format={(v) => `×${v.toFixed(2)}`} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.invertY} onChange={(e) => s.set({ invertY: e.target.checked })} /> Inverser l’axe vertical
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.hints} onChange={(e) => s.set({ hints: e.target.checked })} /> Afficher l’aide des touches
        </label>
      </div>
      <SectionTitle kanji="音">Son</SectionTitle>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!s.muted} onChange={(e) => s.set({ muted: !e.target.checked })} /> Son activé
        </label>
        <Range label="Volume général" value={s.volume} min={0} max={1} step={0.05} onChange={(v) => s.set({ volume: v })} format={(v) => `${Math.round(v * 100)} %`} />
        <Range label="Ambiances" value={s.ambience} min={0} max={1} step={0.05} onChange={(v) => s.set({ ambience: v })} format={(v) => `${Math.round(v * 100)} %`} />
        <Range label="Musique (koto)" value={s.music} min={0} max={1} step={0.05} onChange={(v) => s.set({ music: v })} format={(v) => `${Math.round(v * 100)} %`} />
        <p className="text-xs text-paper-3">Tous les sons sont synthétisés en temps réel : aucun fichier audio n’est téléchargé.</p>
      </div>
      <SectionTitle kanji="記">Données</SectionTitle>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          Mode : {mode === 'firebase' ? <Pill tone="ok">Firebase (serveur)</Pill> : <Pill tone="warn">Démonstration locale</Pill>}
        </div>
        {fallback && <p className="text-[#e9a597]">{fallback}</p>}
        {mode === 'local' && (
          <>
            <p className="text-paper-2">Les données sont enregistrées dans ce navigateur uniquement. Ce mode ne constitue pas une sécurité réelle.</p>
            <ConfirmButton
              onConfirm={async () => {
                await repo().resetDemo?.()
                useVersions.getState().bump('__session', 'archives', 'courses', 'missions', 'members', 'ranks', 'announcements', 'candidatures', 'plans', 'enrollments', 'missionApps', 'reports')
                setDone('Données de démonstration réinitialisées.')
              }}
            >
              Réinitialiser les données de démonstration
            </ConfirmButton>
          </>
        )}
        {mode === 'firebase' && canSeed && (
          <ConfirmButton
            onConfirm={async () => {
              const e = await mutate(['ranks', 'archives', 'courses', 'missions', 'announcements'], (r) => r.seedRemote!())
              if (e) setErr(e)
              else setDone('Grades et contenus de démonstration écrits dans Firestore.')
            }}
          >
            Initialiser Firestore (grades + contenus de démonstration)
          </ConfirmButton>
        )}
        <ErrorNote>{err}</ErrorNote>
        <SuccessNote>{done}</SuccessNote>
      </div>
    </PanelFrame>
  )
}
