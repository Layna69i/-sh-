/**
 * Moteur audio 100 % procédural (Web Audio API) : aucun fichier audio n'est
 * nécessaire. Ambiances par zone, pas selon le sol, portes, interface, pièces
 * de shogi, et musique générative (pincements de koto par synthèse Karplus-Strong
 * sur la gamme miyako-bushi).
 */
import type { ZoneId } from '../world/layout'

export type Surface = 'wood' | 'tatami' | 'stone' | 'gravel' | 'forest'

type Layer = 'wind' | 'leaves' | 'insects' | 'water' | 'room' | 'fire' | 'music' | 'birds' | 'creaks'

const ZONE_MIX: Record<ZoneId, Partial<Record<Layer, number>>> = {
  exterior: { wind: 0.55, leaves: 0.5, insects: 0.35, birds: 0.8, water: 0.12 },
  garden: { wind: 0.25, leaves: 0.3, insects: 0.45, birds: 0.6, water: 0.6 },
  hall: { wind: 0.08, room: 0.5, fire: 0.5, creaks: 0.6, music: 0.25 },
  library: { wind: 0.03, room: 0.55, creaks: 1, fire: 0.2 },
  shogi: { room: 0.4, fire: 0.7, music: 1, creaks: 0.3 },
  dojo: { wind: 0.06, room: 0.5, creaks: 0.6, music: 0.2 },
  missions: { room: 0.5, creaks: 0.5, fire: 0.3 },
  council: { room: 0.5, fire: 0.6, creaks: 0.4, music: 0.3 },
  office: { room: 0.45, fire: 0.5, creaks: 0.4, music: 0.35, wind: 0.08 },
  recruitment: { room: 0.5, fire: 0.3, creaks: 0.4 },
}

const REVERB: Record<ZoneId, number> = {
  exterior: 0.08,
  garden: 0.12,
  hall: 0.55,
  library: 0.35,
  shogi: 0.25,
  dojo: 0.6,
  missions: 0.2,
  council: 0.35,
  office: 0.15,
  recruitment: 0.2,
}

// Gamme in (miyako-bushi) : mi, fa, la, si, do
const SCALE = [164.81, 174.61, 220.0, 246.94, 261.63, 329.63, 349.23, 440.0, 493.88, 523.25]

class AudioEngine {
  ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private amb!: GainNode
  private mus!: GainNode
  private reverb!: ConvolverNode
  private reverbSend!: GainNode
  private noise!: AudioBuffer
  private layers = new Map<Layer, GainNode>()
  private zone: ZoneId = 'exterior'
  private timers: number[] = []
  private vol = { master: 0.8, ambience: 0.8, music: 0.6, muted: false }
  private cascade?: GainNode
  private cascadeLevel = 0

  get started() {
    return !!this.ctx
  }

  /** Doit être appelé depuis un geste utilisateur (politique d'autolecture). */
  async start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.connect(ctx.destination)
    this.sfx = ctx.createGain()
    this.amb = ctx.createGain()
    this.mus = ctx.createGain()
    this.sfx.connect(this.master)
    this.amb.connect(this.master)
    this.mus.connect(this.master)
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.impulse(2.8, 2.6)
    this.reverbSend = ctx.createGain()
    this.reverbSend.gain.value = 0.2
    this.reverbSend.connect(this.reverb)
    this.reverb.connect(this.master)
    this.noise = this.noiseBuffer(3)
    this.applyVolumes()
    this.buildAmbience()
    this.setZone(this.zone, true)
    this.schedule()
  }

  setVolumes(v: { master: number; ambience: number; music: number; muted: boolean }) {
    this.vol = v
    this.applyVolumes()
  }

  private applyVolumes() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.1)
    this.amb.gain.setTargetAtTime(this.vol.ambience * 0.9, t, 0.1)
    this.mus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.1)
    this.sfx.gain.setTargetAtTime(0.9, t, 0.1)
  }

  private noiseBuffer(sec: number) {
    const ctx = this.ctx!
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return b
  }

  private impulse(sec: number, decay: number) {
    const ctx = this.ctx!
    const len = ctx.sampleRate * sec
    const b = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return b
  }

  private loopNoise() {
    const s = this.ctx!.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    s.loopStart = Math.random()
    s.start(0, Math.random() * 2)
    return s
  }

  private lfo(freq: number, depth: number, target: AudioParam) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = depth
    o.connect(g).connect(target)
    o.start()
  }

  private layer(name: Layer, dest: AudioNode = this.amb) {
    const g = this.ctx!.createGain()
    g.gain.value = 0
    g.connect(dest)
    this.layers.set(name, g)
    return g
  }

  private buildAmbience() {
    const ctx = this.ctx!
    // Vent
    {
      const out = this.layer('wind')
      const n = this.loopNoise()
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 500
      lp.Q.value = 0.6
      const g = ctx.createGain()
      g.gain.value = 0.32
      n.connect(lp).connect(g).connect(out)
      this.lfo(0.07, 260, lp.frequency)
      this.lfo(0.11, 0.12, g.gain)
    }
    // Bruissement des feuilles
    {
      const out = this.layer('leaves')
      const n = this.loopNoise()
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 3200
      bp.Q.value = 0.5
      const g = ctx.createGain()
      g.gain.value = 0.045
      n.connect(bp).connect(g).connect(out)
      this.lfo(0.23, 0.035, g.gain)
    }
    // Insectes du crépuscule (stridulations)
    {
      const out = this.layer('insects')
      for (const f of [4300, 5100]) {
        const o = ctx.createOscillator()
        o.frequency.value = f
        const am = ctx.createGain()
        am.gain.value = 0.006
        const gate = ctx.createOscillator()
        gate.type = 'square'
        gate.frequency.value = f === 4300 ? 23 : 29
        const gg = ctx.createGain()
        gg.gain.value = 0.006
        gate.connect(gg).connect(am.gain)
        const slow = ctx.createGain()
        slow.gain.value = 1
        this.lfo(f === 4300 ? 0.4 : 0.31, 1, slow.gain)
        o.connect(am).connect(slow).connect(out)
        o.start()
        gate.start()
      }
    }
    // Eau (bassin, ruissellement)
    {
      const out = this.layer('water')
      const n = this.loopNoise()
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 900
      bp.Q.value = 0.9
      const g = ctx.createGain()
      g.gain.value = 0.12
      n.connect(bp).connect(g).connect(out)
      this.lfo(3.1, 280, bp.frequency)
      this.lfo(0.5, 0.05, g.gain)
    }
    // Cascade du soubassement : bruit large bande + grondement, volume réglé par setCascade
    {
      const out = ctx.createGain()
      out.gain.value = this.cascadeLevel
      out.connect(this.amb)
      this.cascade = out
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 420
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 5600
      const hiss = ctx.createGain()
      hiss.gain.value = 0.16
      this.loopNoise().connect(hp).connect(lp).connect(hiss).connect(out)
      this.lfo(0.37, 0.03, hiss.gain)
      const rumbleLp = ctx.createBiquadFilter()
      rumbleLp.type = 'lowpass'
      rumbleLp.frequency.value = 180
      const rumble = ctx.createGain()
      rumble.gain.value = 0.32
      this.loopNoise().connect(rumbleLp).connect(rumble).connect(out)
      this.lfo(0.21, 0.08, rumble.gain)
    }
    // Tonalité de pièce (souffle grave)
    {
      const out = this.layer('room')
      const n = this.loopNoise()
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 160
      const g = ctx.createGain()
      g.gain.value = 0.12
      n.connect(lp).connect(g).connect(out)
    }
    this.layer('fire')
    this.layer('creaks')
    this.layer('birds')
    this.layer('music', this.mus)
  }

  setZone(zone: ZoneId, immediate = false) {
    this.zone = zone
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const mix = ZONE_MIX[zone]
    for (const [name, g] of this.layers) g.gain.setTargetAtTime(mix[name] ?? 0, t, immediate ? 0.01 : 1.2)
    this.reverbSend.gain.setTargetAtTime(REVERB[zone], t, 0.8)
  }

  /** Niveau de la cascade (0..1), mis à jour selon la distance du joueur. */
  setCascade(level: number) {
    if (Math.abs(level - this.cascadeLevel) < 0.005) return
    this.cascadeLevel = level
    if (this.ctx && this.cascade) this.cascade.gain.setTargetAtTime(level, this.ctx.currentTime, 0.3)
  }

  private schedule() {
    const every = (min: number, max: number, fn: () => void) => {
      const tick = () => {
        fn()
        this.timers.push(window.setTimeout(tick, (min + Math.random() * (max - min)) * 1000))
      }
      this.timers.push(window.setTimeout(tick, (min + Math.random() * (max - min)) * 1000))
    }
    every(2.5, 7, () => this.bird())
    every(0.15, 0.9, () => this.crackle())
    every(5, 14, () => this.creak())
    every(4, 10, () => this.phrase())
  }

  /* ---------------------------- briques sonores ---------------------------- */

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  }

  private burst(opts: { type: BiquadFilterType; freq: number; q?: number; dur: number; gain: number; attack?: number; dest?: AudioNode; when?: number; sweepTo?: number; reverb?: boolean; pan?: number }) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime + (opts.when ?? 0)
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = opts.type
    f.frequency.setValueAtTime(opts.freq, t)
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur)
    f.Q.value = opts.q ?? 1
    const g = ctx.createGain()
    this.env(g, t, opts.attack ?? 0.003, opts.gain, opts.dur)
    let node: AudioNode = s.connect(f).connect(g)
    if (opts.pan !== undefined) {
      const p = ctx.createStereoPanner()
      p.pan.value = opts.pan
      node = node.connect(p)
    }
    node.connect(opts.dest ?? this.sfx)
    if (opts.reverb) node.connect(this.reverbSend)
    s.start(t, Math.random() * 2)
    s.stop(t + (opts.attack ?? 0.003) + opts.dur + 0.05)
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0, dest?: AudioNode, slideTo?: number) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime + when
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    const g = ctx.createGain()
    this.env(g, t, 0.004, gain, dur)
    o.connect(g).connect(dest ?? this.sfx)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  /** Corde pincée (Karplus-Strong par ligne à retard rebouclée). */
  pluck(freq: number, gain = 0.25, when = 0, dest?: AudioNode, bright = 3200) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime + when
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const exc = ctx.createGain()
    exc.gain.setValueAtTime(gain, t)
    exc.gain.setValueAtTime(0, t + 1 / freq + 0.002)
    const delay = ctx.createDelay(0.05)
    delay.delayTime.value = 1 / freq
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = bright
    const fb = ctx.createGain()
    fb.gain.value = 0.985
    const out = ctx.createGain()
    out.gain.setValueAtTime(1, t)
    out.gain.setTargetAtTime(0, t + 1.6, 0.6)
    src.connect(exc).connect(delay)
    delay.connect(lp).connect(fb).connect(delay)
    delay.connect(out)
    out.connect(dest ?? this.sfx)
    out.connect(this.reverbSend)
    src.start(t)
    src.stop(t + 0.05)
    window.setTimeout(() => {
      try {
        out.disconnect()
        fb.disconnect()
      } catch {
        /* déjà déconnecté */
      }
    }, (when + 4.5) * 1000)
  }

  private bird() {
    const g = this.layers.get('birds')
    if (!g || g.gain.value < 0.05 || !this.ctx) return
    const base = 2200 + Math.random() * 2000
    const n = 2 + Math.floor(Math.random() * 4)
    const pan = Math.random() * 2 - 1
    const p = this.ctx.createStereoPanner()
    p.pan.value = pan
    p.connect(g)
    for (let i = 0; i < n; i++) this.tone(base * (0.9 + Math.random() * 0.3), 0.07 + Math.random() * 0.06, 0.05, 'sine', i * (0.09 + Math.random() * 0.05), p, base * (1.2 + Math.random() * 0.4))
  }

  private crackle() {
    const g = this.layers.get('fire')
    if (!g || g.gain.value < 0.05) return
    this.burst({ type: 'highpass', freq: 1800 + Math.random() * 2500, dur: 0.008 + Math.random() * 0.02, gain: 0.06 + Math.random() * 0.08, dest: g, pan: Math.random() - 0.5 })
  }

  private creak() {
    const g = this.layers.get('creaks')
    if (!g || g.gain.value < 0.05 || !this.ctx) return
    const f = 70 + Math.random() * 60
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f, t)
    o.frequency.linearRampToValueAtTime(f * (1.2 + Math.random() * 0.3), t + 0.5)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700 + Math.random() * 500
    bp.Q.value = 6
    const gg = ctx.createGain()
    this.env(gg, t, 0.1, 0.035, 0.5 + Math.random() * 0.4)
    o.connect(bp).connect(gg).connect(g)
    gg.connect(this.reverbSend)
    o.start(t)
    o.stop(t + 1.2)
  }

  private phrase() {
    const g = this.layers.get('music')
    if (!g || g.gain.value < 0.05) return
    const notes = 1 + Math.floor(Math.random() * 4)
    let idx = Math.floor(Math.random() * SCALE.length)
    let when = 0
    for (let i = 0; i < notes; i++) {
      this.pluck(SCALE[idx], 0.16 + Math.random() * 0.06, when, g, 2400)
      idx = Math.max(0, Math.min(SCALE.length - 1, idx + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))))
      when += 0.35 + Math.random() * 0.8
    }
  }

  /* ------------------------------ effets publics ----------------------------- */

  step(surface: Surface, run = false) {
    if (!this.ctx) return
    const k = run ? 1.25 : 1
    switch (surface) {
      case 'wood':
        this.burst({ type: 'lowpass', freq: 380, dur: 0.09, gain: 0.32 * k, reverb: true })
        this.burst({ type: 'bandpass', freq: 1700, q: 2, dur: 0.02, gain: 0.05 * k, reverb: true })
        if (Math.random() < 0.12) this.creak()
        break
      case 'tatami':
        this.burst({ type: 'bandpass', freq: 900, q: 0.8, dur: 0.08, gain: 0.08 * k, attack: 0.01 })
        break
      case 'stone':
        this.burst({ type: 'lowpass', freq: 600, dur: 0.05, gain: 0.25 * k, reverb: true })
        this.burst({ type: 'highpass', freq: 2600, dur: 0.025, gain: 0.06 * k, reverb: true })
        break
      case 'gravel':
        for (let i = 0; i < 4; i++) this.burst({ type: 'bandpass', freq: 2500 + Math.random() * 2500, q: 1.2, dur: 0.03, gain: 0.07 * k, when: i * 0.025 })
        break
      case 'forest':
        this.burst({ type: 'lowpass', freq: 700, dur: 0.1, gain: 0.16 * k, attack: 0.01 })
        this.burst({ type: 'bandpass', freq: 3000, q: 0.7, dur: 0.07, gain: 0.03 * k, when: 0.02 })
        break
    }
  }

  door(kind: 'gate' | 'fusuma' | 'shoji', open: boolean) {
    if (!this.ctx) return
    if (kind === 'gate') {
      const ctx = this.ctx
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(55, t)
      o.frequency.linearRampToValueAtTime(open ? 82 : 48, t + 1.3)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 420
      bp.Q.value = 4
      const g = ctx.createGain()
      this.env(g, t, 0.2, 0.09, 1.3)
      o.connect(bp).connect(g).connect(this.sfx)
      g.connect(this.reverbSend)
      o.start(t)
      o.stop(t + 1.7)
      this.burst({ type: 'lowpass', freq: 160, dur: 0.4, gain: 0.5, when: 1.25, reverb: true })
    } else {
      this.burst({ type: 'bandpass', freq: kind === 'shoji' ? 1500 : 1100, q: 0.7, dur: 0.45, gain: 0.12, attack: 0.06, sweepTo: open ? 1900 : 900, reverb: true })
      this.burst({ type: 'lowpass', freq: 300, dur: 0.08, gain: 0.25, when: 0.48, reverb: true })
    }
  }

  ui(kind: 'open' | 'close' | 'hover' | 'confirm' | 'error' | 'tab') {
    if (!this.ctx) return
    switch (kind) {
      case 'open':
        this.burst({ type: 'highpass', freq: 1200, dur: 0.35, gain: 0.08, attack: 0.08, sweepTo: 5000 })
        this.pluck(SCALE[5], 0.18, 0.05)
        this.pluck(SCALE[7], 0.12, 0.2)
        break
      case 'close':
        this.burst({ type: 'bandpass', freq: 2200, dur: 0.25, gain: 0.07, attack: 0.04, sweepTo: 700 })
        break
      case 'hover':
        this.tone(1800, 0.04, 0.012)
        break
      case 'tab':
        this.burst({ type: 'bandpass', freq: 3000, q: 1.5, dur: 0.06, gain: 0.05 })
        break
      case 'confirm':
        this.pluck(SCALE[6], 0.2)
        this.pluck(SCALE[8], 0.18, 0.12)
        break
      case 'error':
        this.pluck(SCALE[1], 0.25, 0, undefined, 1200)
        break
    }
  }

  piece(capture = false) {
    if (!this.ctx) return
    this.burst({ type: 'bandpass', freq: 2600, q: 3, dur: 0.012, gain: 0.5, reverb: true })
    this.tone(1900, 0.035, 0.08, 'sine')
    this.burst({ type: 'lowpass', freq: 260, dur: 0.05, gain: 0.25 })
    if (capture) this.burst({ type: 'bandpass', freq: 1800, q: 2, dur: 0.012, gain: 0.3, when: 0.07 })
  }

  page() {
    this.burst({ type: 'bandpass', freq: 3500, q: 0.6, dur: 0.22, gain: 0.09, attack: 0.03, sweepTo: 1800 })
  }

  bamboo() {
    if (!this.ctx) return
    this.tone(640, 0.18, 0.25, 'sine', 0, undefined, 600)
    this.tone(1290, 0.1, 0.08, 'triangle')
    this.burst({ type: 'bandpass', freq: 900, q: 2, dur: 0.06, gain: 0.25, reverb: true })
  }

  koto(index = 5) {
    this.pluck(SCALE[Math.max(0, Math.min(SCALE.length - 1, index))], 0.22)
  }
}

export const audio = new AudioEngine()
