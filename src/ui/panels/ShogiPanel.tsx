/**
 * Panneau de la Chambre du Shogi : contrôle de la partie (mode Shogi) et
 * outils de la table stratégique (marqueurs, flèches, annotations, plans).
 * Le plateau lui-même reste dans la scène 3D : on y clique directement.
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { Tabs, Pill, Field, Input, ErrorNote, SuccessNote, Empty, ConfirmButton, SectionTitle } from '../kit'
import { useShogi, handList, initialStrategy, type StratTool } from '../../shogi/store'
import { PIECE_NAMES, PROMOTED_NAMES, KANJI_SHORT, KANJI_PROMOTED, moveLabel, toSfen, inCheck, type PieceType, type Side } from '../../shogi/engine'
import { useSession, mutate } from '../../data/session'
import { useQuery } from '../../data/repository'
import { repo } from '../../data/session'
import { uid as makeId, nowIso, can } from '../../data/types'
import { IconUndo, IconRefresh, IconSave, IconTrash } from '../icons'

const SIDE_LABEL = ['Sente ☗', 'Gote ☖']

function GameTab() {
  const s = useShogi()
  const g = s.game
  const check = inCheck(g)
  const [copied, setCopied] = useState(false)
  let status: string
  if (s.result.kind === 'checkmate') status = `Échec et mat — victoire de ${SIDE_LABEL[s.result.winner]}`
  else if (s.result.kind === 'stalemate') status = `Plus aucun coup légal — victoire de ${SIDE_LABEL[s.result.winner]}`
  else if (s.result.kind === 'repetition') status = 'Sennichite : position répétée quatre fois — partie nulle'
  else status = s.thinking ? 'L’adversaire réfléchit…' : `Au trait : ${SIDE_LABEL[g.turn]}${check ? ' — en échec !' : ''}`

  return (
    <div>
      <div className={`mb-4 flex items-center gap-3 rounded-sm border px-4 py-3 ${s.result.kind !== 'ongoing' ? 'border-amber/70 bg-amber/10' : check ? 'border-blood/70 bg-blood/10' : 'border-amber/20 bg-ink/40'}`}>
        <span className="seal h-9 w-9 text-lg">{g.turn === 0 ? '先' : '後'}</span>
        <div className="flex-1 font-serif text-lg text-paper">{status}</div>
        <Pill>Coup {g.ply + 1}</Pill>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn-ink" onClick={s.undo} disabled={!s.past.length || s.thinking}>
          <IconUndo /> Annuler
        </button>
        <ConfirmButton onConfirm={s.reset}>
          <IconRefresh /> Nouvelle partie
        </ConfirmButton>
        <button
          className="btn-ink"
          onClick={() => {
            void navigator.clipboard?.writeText(toSfen(g)).then(() => setCopied(true))
            window.setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? 'SFEN copié' : 'Copier la position (SFEN)'}
        </button>
      </div>

      <Field label="Adversaire">
        <div className="flex gap-2">
          <button className={`btn-ink flex-1 ${!s.ai ? 'primary' : ''}`} onClick={() => s.setAi(false)}>
            Deux joueurs (même écran)
          </button>
          <button className={`btn-ink flex-1 ${s.ai ? 'primary' : ''}`} onClick={() => s.setAi(true)}>
            IA débutante (Gote)
          </button>
        </div>
      </Field>

      <SectionTitle kanji="駒台">Pièces en réserve</SectionTitle>
      {([0, 1] as Side[]).map((side) => {
        const list = handList(g, side)
        return (
          <div key={side} className="mb-2 flex flex-wrap items-center gap-2">
            <span className="w-20 font-serif text-sm text-paper-2">{SIDE_LABEL[side]}</span>
            {list.length === 0 && <span className="text-sm text-paper-3 italic">aucune</span>}
            {list.map(({ type, count }) => (
              <button
                key={type}
                className={`btn-ink !px-2 !py-1 ${s.selected?.kind === 'hand' && s.selected.type === type && g.turn === side ? 'primary' : ''}`}
                onClick={() => s.selectHand(type, side)}
                disabled={g.turn !== side || s.result.kind !== 'ongoing'}
                title={`Parachuter : ${PIECE_NAMES[type]}`}
              >
                <span className="font-jp">{KANJI_SHORT[type]}</span>
                <span className="text-xs">×{count}</span>
              </button>
            ))}
          </div>
        )
      })}
      <p className="mt-1 text-sm text-paper-3 italic">Cliquez une pièce de votre réserve (sur le komadai ou ci-dessus), puis une case en surbrillance pour la parachuter.</p>

      <SectionTitle kanji="棋譜">Relevé de la partie</SectionTitle>
      {g.history.length === 0 ? (
        <p className="text-paper-3 italic">Aucun coup joué. Sente commence : cliquez une de vos pièces sur le plateau.</p>
      ) : (
        <ol className="grid max-h-40 grid-cols-2 gap-x-4 overflow-y-auto font-jp text-sm text-paper-2 sm:grid-cols-3">
          {g.history.map((m, i) => (
            <li key={i}>
              <span className="mr-1 font-serif text-paper-3">{i + 1}.</span>
              {moveLabel(m, (i % 2) as Side)}
            </li>
          ))}
        </ol>
      )}

      <details className="mt-5 rounded-sm border border-amber/15 bg-ink/30 p-3">
        <summary className="cursor-pointer font-serif text-paper">Aide-mémoire des règles</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-paper-2">
          <li>Le but est de mettre le roi adverse en échec et mat.</li>
          <li>Une pièce capturée rejoint votre réserve et peut être parachutée sur une case libre à la place d’un coup.</li>
          <li>Dans les trois dernières rangées adverses, la plupart des pièces peuvent être promues (elles se retournent, caractères rouges).</li>
          <li>Interdits : deux pions non promus sur une même colonne (nifu), un pion parachuté qui donne mat immédiatement (uchifuzume), une pièce parachutée sans coup possible.</li>
          <li>Une même position répétée quatre fois rend la partie nulle (sennichite).</li>
        </ul>
      </details>
      <p className="mt-3 text-xs text-paper-3">Partie locale sauvegardée dans ce navigateur. L’état étant décrit en SFEN, le moteur est prêt pour de futures parties en réseau.</p>
    </div>
  )
}

const TOOLS: { id: StratTool; label: string; kanji: string }[] = [
  { id: 'move', label: 'Déplacer', kanji: '動' },
  { id: 'piece', label: 'Poser une pièce', kanji: '駒' },
  { id: 'marker', label: 'Marqueur', kanji: '印' },
  { id: 'arrow', label: 'Flèche', kanji: '矢' },
  { id: 'note', label: 'Annotation', kanji: '記' },
  { id: 'erase', label: 'Gomme', kanji: '消' },
]
const COLORS = ['#c0392b', '#d3a15b', '#3f7d6a', '#3d5a8a', '#e8e0cc', '#111111']
const TYPES: PieceType[] = ['K', 'R', 'B', 'G', 'S', 'N', 'L', 'P']

function StrategyTab() {
  const s = useShogi()
  const session = useSession((x) => x.session)
  const member = !!session.member
  const allowed = can(session, 'strategy.use')
  const plans = useQuery(['plans'], () => repo().listPlans(), [session.user?.uid])
  const [shared, setShared] = useState(false)
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({})

  const save = async () => {
    const name = s.planName.trim() || `Plan du ${new Date().toLocaleDateString('fr-FR')}`
    const existing = plans.data?.find((p) => p.name === name && p.ownerUid === session.user?.uid)
    const err = await mutate(['plans'], (r) =>
      r.savePlan({ id: existing?.id ?? makeId('plan'), name, ownerUid: session.user?.uid ?? '', ownerName: session.member?.name ?? '', shared, data: s.strat, createdAt: existing?.createdAt ?? nowIso(), updatedAt: nowIso() }),
    )
    setMsg(err ? { err } : { ok: `Plan « ${name} » enregistré.` })
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {TOOLS.map((t) => (
          <button key={t.id} className={`btn-ink !justify-start !px-3 ${s.tool === t.id ? 'primary' : ''}`} onClick={() => s.patch({ tool: t.id, arrowFrom: null })}>
            <span className="font-jp">{t.kanji}</span>
            <span className="text-sm">{t.label}</span>
          </button>
        ))}
      </div>
      {(s.tool === 'marker' || s.tool === 'arrow') && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-paper-2">Couleur</span>
          {COLORS.map((c) => (
            <button key={c} aria-label={`Couleur ${c}`} onClick={() => s.patch({ color: c })} className={`h-7 w-7 rounded-full border-2 ${s.color === c ? 'border-amber' : 'border-transparent'}`} style={{ background: c }} />
          ))}
        </div>
      )}
      {s.tool === 'piece' && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button key={t} className={`btn-ink !px-2 !py-1 ${s.pieceType === t ? 'primary' : ''}`} onClick={() => s.patch({ pieceType: t })} title={PIECE_NAMES[t]}>
                <span className="font-jp">{KANJI_SHORT[t]}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {([0, 1] as Side[]).map((side) => (
              <button key={side} className={`btn-ink flex-1 ${s.pieceSide === side ? 'primary' : ''}`} onClick={() => s.patch({ pieceSide: side })}>
                {SIDE_LABEL[side]}
              </button>
            ))}
          </div>
        </div>
      )}
      {s.tool === 'note' && (
        <Field label="Texte de l’annotation" hint="Saisissez le texte, puis cliquez une case du plateau.">
          <Input value={s.noteText} maxLength={80} onChange={(e) => s.patch({ noteText: e.target.value })} placeholder="Ex. : point faible du flanc gauche" />
        </Field>
      )}
      <p className="mb-3 text-sm text-paper-3 italic">
        {s.tool === 'move' && 'Faites glisser les pièces librement sur le plateau.'}
        {s.tool === 'piece' && 'Cliquez une case pour y poser la pièce choisie.'}
        {s.tool === 'marker' && 'Cliquez une case pour y poser un marqueur.'}
        {s.tool === 'arrow' && (s.arrowFrom ? 'Cliquez la case d’arrivée de la flèche.' : 'Cliquez la case de départ, puis celle d’arrivée.')}
        {s.tool === 'erase' && 'Cliquez une case pour effacer ce qui s’y trouve.'}
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        <button className="btn-ink" onClick={() => s.setStrat(initialStrategy(true))}>
          Position initiale
        </button>
        <ConfirmButton onConfirm={() => s.setStrat(initialStrategy(false))}>Vider la table</ConfirmButton>
      </div>

      <SectionTitle kanji="策">Plans enregistrés</SectionTitle>
      {!member ? (
        <p className="text-sm text-paper-2 italic">La table est libre d’usage. L’enregistrement des plans est réservé aux membres connectés.</p>
      ) : !allowed ? (
        <p className="text-sm text-paper-2 italic">Votre grade ne permet pas d’enregistrer des plans.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Nom du plan">
                <Input value={s.planName} onChange={(e) => s.patch({ planName: e.target.value })} placeholder="Ex. : défense du col nord" maxLength={60} />
              </Field>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-paper-2">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Partager avec les membres
            </label>
            <button className="btn-ink primary" onClick={save}>
              <IconSave /> Enregistrer
            </button>
          </div>
          <ErrorNote>{msg.err}</ErrorNote>
          <SuccessNote>{msg.ok}</SuccessNote>
          {plans.loading ? null : !plans.data?.length ? (
            <Empty kanji="空">Aucun plan enregistré pour l’instant.</Empty>
          ) : (
            <ul className="divide-y divide-amber/10">
              {plans.data.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-paper">{p.name}</div>
                    <div className="text-xs text-paper-3">
                      {p.ownerName} · {new Date(p.updatedAt).toLocaleString('fr-FR')} {p.shared && '· partagé'}
                    </div>
                  </div>
                  <button
                    className="btn-ink !py-1"
                    onClick={() => {
                      s.setStrat(structuredClone(p.data), p.name)
                      setMsg({ ok: `Plan « ${p.name} » chargé.` })
                    }}
                  >
                    Charger
                  </button>
                  {p.ownerUid === session.user?.uid && (
                    <button className="btn-ink danger !py-1" aria-label="Supprimer" onClick={async () => setMsg((await mutate(['plans'], (r) => r.deletePlan(p.id))) ? { err: 'Suppression impossible.' } : { ok: 'Plan supprimé.' })}>
                      <IconTrash />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function PromotionDialog() {
  const promo = useShogi((s) => s.promotion)
  const choose = useShogi((s) => s.choosePromotion)
  return (
    <AnimatePresence>
      {promo && (
        <motion.div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="scroll-panel w-[min(420px,92vw)] p-6 text-center">
            <div className="font-jp text-3xl text-amber">成</div>
            <h3 className="mt-2 font-serif text-xl text-paper">Promouvoir la pièce ?</h3>
            <p className="mt-1 text-sm text-paper-2">
              {PIECE_NAMES[promo.yes.type]} → {PROMOTED_NAMES[promo.yes.type]}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button className="btn-ink primary" onClick={() => choose(true)} autoFocus>
                <span className="font-jp">{KANJI_PROMOTED[promo.yes.type]}</span> Promouvoir
              </button>
              <button className="btn-ink" onClick={() => choose(false)}>
                <span className="font-jp">{KANJI_SHORT[promo.yes.type]}</span> Garder
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function ShogiPanel({ close }: PanelProps) {
  const mode = useShogi((s) => s.mode)
  const setMode = useShogi((s) => s.setMode)
  return (
    <>
      <PanelFrame
        title="La Chambre du Shogi"
        kanji="将棋"
        subtitle="« Chaque pièce possède une fonction. »"
        onClose={close}
        width="md"
        mobileSheet
        footer={
          <button className="btn-ink w-full" onClick={close}>
            Quitter la table
          </button>
        }
      >
        <Tabs
          value={mode}
          onChange={(m) => setMode(m)}
          items={[
            { id: 'game', label: 'Partie', kanji: '対局' },
            { id: 'strategy', label: 'Table stratégique', kanji: '軍議' },
          ]}
        />
        {mode === 'game' ? <GameTab /> : <StrategyTab />}
      </PanelFrame>
      <PromotionDialog />
    </>
  )
}
