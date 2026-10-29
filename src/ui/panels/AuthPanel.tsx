/**
 * Compte : connexion (comptes de démonstration en mode local, e-mail et mot de
 * passe avec Firebase), état de la session, déconnexion.
 */
import { useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { Field, Input, ErrorNote, SuccessNote, Pill, SectionTitle, InkAvatar, ClearanceBadge, Tabs } from '../kit'
import { useSession, repo } from '../../data/session'
import { ALL_PERMISSIONS } from '../../data/types'
import { audio } from '../../audio/engine'

function SessionCard() {
  const session = useSession((s) => s.session)
  if (!session.user)
    return (
      <div className="flex items-center gap-3 rounded-sm border border-amber/15 bg-ink/40 p-4">
        <span className="seal h-12 w-12 text-xl">客</span>
        <div>
          <div className="font-serif text-lg text-paper">Visiteur</div>
          <div className="text-sm text-paper-2">Accès aux espaces publics : présentation, enseignements publics, hiérarchie, candidature.</div>
        </div>
      </div>
    )
  return (
    <div className="flex items-start gap-3 rounded-sm border border-amber/25 bg-ink/40 p-4">
      <InkAvatar seed={session.member?.avatarSeed ?? 1} size={56} kanji={session.rank?.kanji} url={session.member?.avatarUrl} />
      <div className="flex-1">
        <div className="font-serif text-lg text-paper">{session.member?.name ?? session.user.displayName}</div>
        {session.member ? (
          <div className="text-sm text-amber/90">
            {session.rank?.kanji} {session.rank?.name ?? 'Grade inconnu'} · <ClearanceBadge level={session.clearance} />
          </div>
        ) : (
          <div className="text-sm text-paper-2">Compte connecté sans fiche membre : déposez une candidature au Bureau de Recrutement. La direction pourra ensuite vous associer une fiche.</div>
        )}
        {session.user.email && <div className="text-xs text-paper-3">{session.user.email}</div>}
        {session.user.provider === 'firebase' && <div className="selectable text-xs text-paper-3">Identifiant : {session.user.uid}</div>}
        {session.perms.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {session.perms.map((p) => (
              <span key={p} className="rounded-sm bg-amber/10 px-1.5 py-0.5 text-[11px] text-amber">
                {ALL_PERMISSIONS.find((x) => x.id === p)?.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FirebaseLogin() {
  const [tab, setTab] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    setErr(null)
    try {
      if (tab === 'in') await repo().signIn!(email.trim(), password)
      else {
        if (name.trim().length < 2) throw new Error('Indiquez un nom affiché.')
        await repo().signUp!(email.trim(), password, name.trim())
      }
      audio.ui('confirm')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      audio.ui('error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <Tabs<'in' | 'up'>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'in', label: 'Se connecter' },
          { id: 'up', label: 'Créer un compte' },
        ]}
      />
      {tab === 'up' && (
        <Field label="Nom affiché">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
        </Field>
      )}
      <Field label="Adresse e-mail">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </Field>
      <Field label="Mot de passe">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === 'in' ? 'current-password' : 'new-password'} onKeyDown={(e) => e.key === 'Enter' && go()} />
      </Field>
      <ErrorNote>{err}</ErrorNote>
      <button className="btn-ink primary" onClick={go} disabled={busy || !email || !password}>
        {busy ? '…' : tab === 'in' ? 'Se connecter' : 'Créer le compte'}
      </button>
    </div>
  )
}

function DemoLogin() {
  const accounts = repo().demoAccounts ?? []
  const current = useSession((s) => s.session.user?.uid)
  const [ok, setOk] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <div className="rounded-sm border border-amber/40 bg-amber/10 p-3 text-sm">
        <strong className="text-amber">Mode démonstration local.</strong> Aucune configuration Firebase n’est présente : les comptes ci-dessous servent à essayer les rôles. Ils ne protègent rien — le stockage du navigateur est modifiable par quiconque. Pour une vraie authentification, configurez Firebase (voir le README).
      </div>
      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a.uid}>
            <button
              className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition ${current === a.uid ? 'border-amber bg-amber/10' : 'border-amber/20 hover:border-amber/60'}`}
              onClick={async () => {
                await repo().signInDemo!(a.uid)
                setOk(`Connecté en tant que ${a.label}.`)
                audio.ui('confirm')
              }}
            >
              <span className="flex-1">
                <span className="block text-paper">{a.label}</span>
                <span className="block text-sm text-paper-3">{a.role}</span>
              </span>
              {current === a.uid && <Pill tone="amber">Actif</Pill>}
            </button>
          </li>
        ))}
      </ul>
      <SuccessNote>{ok}</SuccessNote>
    </div>
  )
}

export default function AuthPanel({ close }: PanelProps) {
  const mode = useSession((s) => s.mode)
  const user = useSession((s) => s.session.user)
  return (
    <PanelFrame title="Votre sceau" kanji="印" subtitle="Compte et accès" onClose={close} width="md">
      <SessionCard />
      {user && (
        <button
          className="btn-ink mt-3"
          onClick={async () => {
            await repo().signOut()
            audio.ui('close')
          }}
        >
          Se déconnecter
        </button>
      )}
      <SectionTitle kanji="入">{mode === 'firebase' ? 'Connexion' : 'Comptes de démonstration'}</SectionTitle>
      {mode === 'firebase' ? user ? <p className="text-sm text-paper-2">Vous êtes connecté.</p> : <FirebaseLogin /> : mode === 'local' ? <DemoLogin /> : <p className="text-paper-2 italic">Initialisation…</p>}
    </PanelFrame>
  )
}
