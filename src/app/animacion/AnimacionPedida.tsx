'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CONFIG } from './config'

// ============================================================
// Curvas de easing profesionales
// ============================================================
const Easing = {
  inOutCubic: (t: number) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2,
  inOutQuart: (t: number) => t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t + 2, 4) / 2,
  outExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10*t),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
}

// ============================================================
// Tipos
// ============================================================
type SceneType = 'logo' | 'photo' | 'final'

interface Scene {
  id: string
  type: SceneType
  duration: number
  start: number
  end: number
  transitionIn: number
  transitionOut: number
  photoIndex?: number
}

interface Particle {
  x: number
  y: number
  vy: number
  amp: number
  freq: number
  phase: number
  baseOpacity: number
  opacityAmp: number
  opacityFreq: number
  opacityPhase: number
  depth: number
  size: number
}

// ============================================================
// Hook del timeline
// ============================================================
function useTimeline() {
  const scenesRef = useRef<Scene[]>([])
  const totalDurationRef = useRef(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(true)
  const lastTimeRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const onSceneChangeRef = useRef<((scene: Scene, index: number) => void) | null>(null)
  const isPlayingRef = useRef(isPlaying)
  const speedRef = useRef(CONFIG.style.speed || 1)

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // Construir timeline
  useEffect(() => {
    const tl = CONFIG.timeline
    const scenes: Scene[] = []
    let total = 0
    scenes.push({
      id: 'scene-logo', type: 'logo', duration: tl.logoIntro,
      start: total, end: total + tl.logoIntro,
      transitionIn: 1.5, transitionOut: 1.4
    })
    total += tl.logoIntro
    CONFIG.images.photos.forEach((_, i) => {
      scenes.push({
        id: `scene-photo-${i}`, type: 'photo', photoIndex: i,
        duration: tl.photoDuration,
        start: total, end: total + tl.photoDuration,
        transitionIn: tl.photoTransition, transitionOut: tl.photoTransition
      })
      total += tl.photoDuration
    })
    scenes.push({
      id: 'scene-final', type: 'final', duration: tl.finalScene,
      start: total, end: total + tl.finalScene,
      transitionIn: 1.5, transitionOut: 1.2
    })
    total += tl.finalScene + tl.loopPause
    scenesRef.current = scenes
    totalDurationRef.current = total
  }, [])

  // Loop principal con refs para evitar reinicios
  useEffect(() => {
    const loop = (time: number) => {
      let dt = time - lastTimeRef.current
      if (dt > 500) dt = 500
      if (dt < 0) dt = 0
      lastTimeRef.current = time

      if (isPlayingRef.current) {
        setCurrentTime(prev => {
          const speed = speedRef.current
          let next = prev + (dt / 1000) * speed
          const total = totalDurationRef.current
          if (next >= total) next = next % total
          return next
        })
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Detectar cambio de escena
  useEffect(() => {
    const scenes = scenesRef.current
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i]
      if (currentTime >= s.start && currentTime < s.end) {
        if (i !== currentSceneIndex) {
          setCurrentSceneIndex(i)
          if (onSceneChangeRef.current) {
            onSceneChangeRef.current(s, i)
          }
        }
        break
      }
    }
  }, [currentTime, currentSceneIndex])

  // Calcular opacidades
  const getOpacities = useCallback(() => {
    return scenesRef.current.map(scene => {
      const tIn = scene.transitionIn
      const tOut = scene.transitionOut
      let opacity = 0
      if (currentTime < scene.start) {
        opacity = 0
      } else if (currentTime >= scene.start && currentTime < scene.start + tIn) {
        const t = (currentTime - scene.start) / tIn
        opacity = Easing.inOutQuart(t)
      } else if (currentTime >= scene.start + tIn && currentTime < scene.end - tOut) {
        opacity = 1
      } else if (currentTime >= scene.end - tOut && currentTime < scene.end) {
        const t = (currentTime - (scene.end - tOut)) / tOut
        opacity = 1 - Easing.inOutQuart(t)
      } else {
        opacity = 0
      }
      return { scene, opacity }
    })
  }, [currentTime])

  const jumpToScene = useCallback((index: number) => {
    const scenes = scenesRef.current
    if (index >= 0 && index < scenes.length) {
      setCurrentTime(scenes[index].start + 0.1)
      setCurrentSceneIndex(-1)
    }
  }, [])

  const seekTo = useCallback((time: number) => {
    const total = totalDurationRef.current
    setCurrentTime(Math.max(0, Math.min(time, total)))
    setCurrentSceneIndex(-1)
  }, [])

  return {
    scenes: scenesRef.current,
    totalDuration: totalDurationRef.current,
    currentTime,
    currentSceneIndex,
    isPlaying,
    setIsPlaying,
    getOpacities,
    jumpToScene,
    seekTo,
    onSceneChangeRef
  }
}

// ============================================================
// Sistema de partículas
// ============================================================
function useParticles(containerRef: React.RefObject<HTMLDivElement | null>) {
  const particlesRef = useRef<Particle[]>([])
  const elementsRef = useRef<HTMLDivElement[]>([])
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const opts = CONFIG.style.particles
    const w = window.innerWidth
    const h = window.innerHeight
    const particles: Particle[] = []
    const elements: HTMLDivElement[] = []

    for (let i = 0; i < opts.count; i++) {
      const size = opts.minSize + Math.random() * (opts.maxSize - opts.minSize)
      const el = document.createElement('div')
      el.className = 'np-particle'
      el.style.width = size + 'px'
      el.style.height = size + 'px'
      el.style.opacity = String(opts.minOpacity)
      container.appendChild(el)
      elements.push(el)
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vy: -(0.15 + Math.random() * 0.4) * opts.speed,
        amp: 20 + Math.random() * 60,
        freq: 0.0005 + Math.random() * 0.001,
        phase: Math.random() * Math.PI * 2,
        baseOpacity: opts.minOpacity + Math.random() * (opts.maxOpacity - opts.minOpacity),
        opacityAmp: 0.2 + Math.random() * 0.3,
        opacityFreq: 0.001 + Math.random() * 0.002,
        opacityPhase: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.7,
        size
      })
    }
    particlesRef.current = particles
    elementsRef.current = elements

    const loop = (time: number) => {
      let dt = time - lastTimeRef.current
      if (dt > 500) dt = 500
      if (dt < 0) dt = 0
      lastTimeRef.current = time
      const now = performance.now()
      const w = window.innerWidth
      const h = window.innerHeight

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const el = elements[i]
        p.y += p.vy * dt * 0.06
        p.x += Math.sin(now * p.freq + p.phase) * 0.3 * p.depth
        if (p.y < -20) {
          p.y = h + 20
          p.x = Math.random() * w
          p.phase = Math.random() * Math.PI * 2
        }
        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        const opacity = p.baseOpacity + Math.sin(now * p.opacityFreq + p.opacityPhase) * p.opacityAmp
        const clampedOpacity = Math.max(0, Math.min(1, opacity))
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.depth})`
        el.style.opacity = String(clampedOpacity)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      elements.forEach(el => el.remove())
    }
  }, [containerRef])
}

// ============================================================
// Animaciones CSS
// ============================================================
const ANIMATION_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500&display=swap');

.np-stage {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, #1a1410 0%, #0a0707 60%, #000 100%);
  overflow: hidden;
  perspective: 1200px;
  font-family: 'Cormorant Garamond', 'Playfair Display', 'Times New Roman', serif;
  color: #F5EFE0;
}
.np-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.np-particle {
  position: absolute;
  border-radius: 50%;
  background: #D4AF37;
  box-shadow: 0 0 6px #D4AF37, 0 0 12px rgba(212,175,55,0.4), 0 0 24px rgba(212,175,55,0.2);
  pointer-events: none;
  will-change: transform, opacity;
}
.np-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.75) 100%);
}
.np-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 49;
  opacity: 0.04;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.np-scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  z-index: 2;
  pointer-events: none;
  will-change: opacity, transform;
}
.np-scene-active { z-index: 3; }

/* === Escena Logo === */
.np-scene-logo { flex-direction: column; gap: 0; }
.np-logo-container {
  position: relative;
  width: min(900px, 50vw);
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1000px;
}
.np-logo-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 30px rgba(212, 175, 55, 0.3));
}
.np-logo-rings {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: -1;
}
.np-logo-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid rgba(212,175,55,0.4);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.np-logo-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(105deg, transparent 30%, rgba(212,175,55,0) 40%, rgba(212,175,55,0.4) 50%, rgba(255,220,130,0.6) 55%, rgba(212,175,55,0.4) 60%, rgba(212,175,55,0) 70%, transparent 80%);
  transform: skewX(-15deg);
  pointer-events: none;
  mix-blend-mode: screen;
}
.np-logo-text { margin-top: 50px; text-align: center; }
.np-logo-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(28px, 3vw, 52px);
  font-weight: 300;
  letter-spacing: 0.6em;
  color: #D4AF37;
  text-transform: uppercase;
  text-shadow: 0 0 30px rgba(212,175,55,0.4);
  margin-left: 0.6em;
}
.np-logo-subtitle {
  margin-top: 24px;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(20px, 2vw, 36px);
  letter-spacing: 0.4em;
  color: #F5EFE0;
  font-style: italic;
  margin-left: 0.4em;
}

/* === Escenas Fotos === */
.np-photo-scene { flex-direction: column; }
.np-photo-frame { position: absolute; inset: 0; overflow: hidden; }
.np-photo-img {
  position: absolute;
  inset: -8%;
  width: 116%;
  height: 116%;
  object-fit: cover;
  will-change: transform;
  filter: brightness(0.85) contrast(1.05) saturate(0.9);
}
.np-photo-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.7) 100%);
  pointer-events: none;
  z-index: 2;
}
.np-photo-border {
  position: absolute;
  top: 5vh;
  left: 5vw;
  right: 5vw;
  bottom: 5vh;
  border: 1px solid rgba(212,175,55,0.4);
  pointer-events: none;
  z-index: 5;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.3), inset 0 0 80px rgba(0,0,0,0.4);
}
.np-photo-border::before,
.np-photo-border::after,
.np-photo-border .corner-tr,
.np-photo-border .corner-bl {
  content: '';
  position: absolute;
  width: 60px;
  height: 60px;
  border: 2px solid #D4AF37;
}
.np-photo-border::before { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.np-photo-border::after { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.np-photo-border .corner-tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.np-photo-border .corner-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
.np-photo-caption {
  position: absolute;
  bottom: 12vh;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 6;
  white-space: nowrap;
}
.np-photo-caption .divider {
  display: inline-block;
  width: 60px;
  height: 1px;
  background: #D4AF37;
  vertical-align: middle;
  margin: 0 28px;
  box-shadow: 0 0 8px rgba(212,175,55,0.4);
}
.np-photo-caption .text {
  display: inline-block;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(22px, 2.2vw, 42px);
  letter-spacing: 0.4em;
  color: #D4AF37;
  text-transform: uppercase;
  vertical-align: middle;
  text-shadow: 0 0 20px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.7);
  margin-left: 0.4em;
}
.np-photo-counter {
  position: absolute;
  top: 7vh;
  right: 7vw;
  z-index: 6;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  letter-spacing: 0.3em;
  color: rgba(245,239,224,0.6);
  text-transform: uppercase;
}
.np-photo-counter .current {
  color: #D4AF37;
  font-size: 18px;
  font-weight: 500;
}

/* === Escena Final === */
.np-scene-final { flex-direction: column; }
.np-final-logo {
  width: min(500px, 35vw);
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 40px rgba(212, 175, 55, 0.4));
}
.np-final-phrase {
  margin-top: 50px;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(36px, 4vw, 64px);
  font-style: italic;
  font-weight: 400;
  color: #D4AF37;
  text-shadow: 0 0 30px rgba(212,175,55,0.4);
  text-align: center;
  letter-spacing: 0.02em;
}
.np-final-signature {
  margin-top: 28px;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(20px, 1.8vw, 32px);
  letter-spacing: 0.6em;
  color: #F5EFE0;
  text-transform: uppercase;
  margin-left: 0.6em;
}
.np-final-closing {
  margin-top: 50px;
  font-family: 'Inter', sans-serif;
  font-size: clamp(11px, 0.9vw, 13px);
  letter-spacing: 0.5em;
  color: rgba(245,239,224,0.6);
  text-transform: uppercase;
  margin-left: 0.5em;
}

/* === HUD === */
.np-hud {
  position: fixed;
  bottom: 16px;
  left: 16px;
  z-index: 100;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  color: rgba(245,239,224,0.6);
  background: rgba(0, 0, 0, 0.7);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  backdrop-filter: blur(8px);
}
.np-hud.np-visible { opacity: 1; pointer-events: auto; }
.np-hud h4 {
  color: #D4AF37;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  margin-bottom: 8px;
  font-weight: 500;
}
.np-hud kbd {
  display: inline-block;
  padding: 2px 6px;
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 3px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 10px;
  color: #F5EFE0;
  margin-right: 6px;
}
.np-hud .row { margin: 4px 0; }
.np-hud .scene-info {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(212, 175, 55, 0.15);
  font-size: 12px;
  color: #F5EFE0;
}
.np-hud .scene-info .label {
  color: rgba(245,239,224,0.6);
  margin-right: 8px;
}

/* === Barra de progreso === */
.np-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #D4AF37, transparent);
  z-index: 99;
  width: 0%;
  opacity: 0;
  transition: opacity 0.3s;
}
.np-progress-bar.np-visible { opacity: 0.8; }

/* === Keyframes === */
@keyframes npLogoAppear {
  0% { opacity: 0; transform: scale(0.85) translateY(20px); filter: blur(12px) drop-shadow(0 0 0 rgba(212, 175, 55, 0)); }
  50% { opacity: 0.6; filter: blur(4px) drop-shadow(0 0 20px rgba(212, 175, 55, 0.2)); }
  100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0) drop-shadow(0 0 30px rgba(212, 175, 55, 0.3)); }
}
@keyframes npShineSweep {
  0% { left: -100%; opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { left: 200%; opacity: 0; }
}
@keyframes npRingExpand {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  40% { opacity: 0.7; }
  100% { opacity: 0.2; transform: translate(-50%, -50%) scale(1); }
}
@keyframes npTextRise {
  0% { opacity: 0; transform: translateY(25px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes npKenBurnsA { 0% { transform: scale(1.0) translate(0, 0); } 100% { transform: scale(1.18) translate(-2%, -1.5%); } }
@keyframes npKenBurnsB { 0% { transform: scale(1.2) translate(2%, 1%); } 100% { transform: scale(1.0) translate(0, 0); } }
@keyframes npKenBurnsC { 0% { transform: scale(1.05) translate(0, 2%); } 100% { transform: scale(1.2) translate(0, -2%); } }
@keyframes npKenBurnsD { 0% { transform: scale(1.0) translate(2%, -1%); } 100% { transform: scale(1.15) translate(-2%, 1.5%); } }
@keyframes npKenBurnsE { 0% { transform: scale(1.18) translate(-1.5%, 1%); } 100% { transform: scale(1.0) translate(1%, 0); } }
@keyframes npCaptionRise {
  0% { opacity: 0; transform: translate(-50%, 30px); filter: blur(8px); }
  100% { opacity: 1; transform: translate(-50%, 0); filter: blur(0); }
}
@keyframes npFinalLogoIn {
  0% { opacity: 0; transform: scale(0.9) translateY(20px); filter: blur(10px); }
  60% { opacity: 0.8; filter: blur(2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
}
@keyframes npPhraseIn {
  0% { opacity: 0; transform: translateY(30px); filter: blur(6px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}
`

// ============================================================
// Componente principal
// ============================================================
export default function AnimacionPedida() {
  const particlesContainerRef = useRef<HTMLDivElement>(null)
  const sceneElementsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const [hudVisible, setHudVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeSceneInfo, setActiveSceneInfo] = useState<{id: string, type: string} | null>(null)

  const {
    scenes, totalDuration, currentTime, currentSceneIndex,
    isPlaying, setIsPlaying, getOpacities, jumpToScene, seekTo,
    onSceneChangeRef
  } = useTimeline()

  useParticles(particlesContainerRef)

  // Exponer estado globalmente
  useEffect(() => {
    ;(window as any).__anim = {
      timeline: {
        currentTime, totalDuration, currentSceneIndex, isPlaying, scenes,
        seekTo, jumpToScene,
        play: () => setIsPlaying(true),
        pause: () => setIsPlaying(false)
      }
    }
  }, [currentTime, totalDuration, currentSceneIndex, isPlaying, scenes, seekTo, jumpToScene, setIsPlaying])

  // Callback de cambio de escena
  onSceneChangeRef.current = (scene: Scene, index: number) => {
    setActiveSceneInfo({ id: scene.id, type: scene.type })
    const el = sceneElementsRef.current[scene.id]
    if (!el) return

    if (scene.type === 'photo') {
      const img = el.querySelector('.np-photo-img') as HTMLImageElement
      const caption = el.querySelector('.np-photo-caption') as HTMLElement
      const variations = ['npKenBurnsA', 'npKenBurnsB', 'npKenBurnsC', 'npKenBurnsD', 'npKenBurnsE']
      if (img) {
        img.style.animation = 'none'
        void img.offsetHeight
        img.style.animation = `${variations[(scene.photoIndex || 0) % variations.length]} 8s ease-out forwards`
      }
      if (caption) {
        caption.style.animation = 'none'
        void caption.offsetHeight
        caption.style.animation = 'npCaptionRise 1.2s ease-out 0.5s forwards'
      }
    } else if (scene.type === 'logo') {
      const logoImg = el.querySelector('.np-logo-img') as HTMLImageElement
      const shine = el.querySelector('.np-logo-shine') as HTMLElement
      const title = el.querySelector('.np-logo-title') as HTMLElement
      const subtitle = el.querySelector('.np-logo-subtitle') as HTMLElement
      const rings = el.querySelectorAll('.np-logo-ring')
      ;[logoImg, shine, title, subtitle].forEach(elem => {
        if (elem) { elem.style.animation = 'none'; void elem.offsetHeight }
      })
      if (logoImg) logoImg.style.animation = 'npLogoAppear 3s ease-out 0.3s forwards'
      if (shine) shine.style.animation = 'npShineSweep 3s ease-in-out 1.8s forwards'
      if (title) title.style.animation = 'npTextRise 1.5s ease-out 1.2s forwards'
      if (subtitle) subtitle.style.animation = 'npTextRise 1.5s ease-out 1.8s forwards'
      rings.forEach((r, i) => {
        r.style.animation = 'none'
        void r.offsetHeight
        r.style.animation = `npRingExpand 3s ease-out ${0.8 + i * 0.3}s forwards`
      })
    } else if (scene.type === 'final') {
      const logo = el.querySelector('.np-final-logo') as HTMLImageElement
      const phrase = el.querySelector('.np-final-phrase') as HTMLElement
      const signature = el.querySelector('.np-final-signature') as HTMLElement
      const closing = el.querySelector('.np-final-closing') as HTMLElement
      ;[logo, phrase, signature, closing].forEach(elem => {
        if (elem) { elem.style.animation = 'none'; void elem.offsetHeight }
      })
      if (logo) logo.style.animation = 'npFinalLogoIn 2s ease-out 0.3s forwards'
      if (phrase) phrase.style.animation = 'npPhraseIn 1.8s ease-out 1.4s forwards'
      if (signature) signature.style.animation = 'npPhraseIn 1.8s ease-out 2.2s forwards'
      if (closing) closing.style.animation = 'npPhraseIn 1.5s ease-out 3s forwards'
    }
  }

  // Aplicar opacidades
  useEffect(() => {
    const opacities = getOpacities()
    for (const { scene, opacity } of opacities) {
      const el = sceneElementsRef.current[scene.id]
      if (el) {
        el.style.opacity = opacity.toFixed(3)
        if (opacity > 0.01) {
          el.style.zIndex = String(3 + Math.floor(opacity * 10))
          el.classList.add('np-scene-active')
        } else {
          el.style.zIndex = '2'
          el.classList.remove('np-scene-active')
        }
      }
    }
    setProgress((currentTime / totalDuration) * 100)
  }, [currentTime, getOpacities, totalDuration])

  // Controles de teclado
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch(e.key) {
        case '?': case '¿': setHudVisible(v => !v); break
        case ' ': e.preventDefault(); setIsPlaying(!isPlaying); break
        case 'f': case 'F':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {})
          } else { document.exitFullscreen() }
          break
        case 'r': case 'R': seekTo(0); break
        case 'ArrowRight': jumpToScene(Math.min(currentSceneIndex + 1, scenes.length - 1)); break
        case 'ArrowLeft': jumpToScene(Math.max(currentSceneIndex - 1, 0)); break
        default:
          if (e.key >= '1' && e.key <= '9') {
            const idx = parseInt(e.key) - 1
            if (idx < scenes.length) jumpToScene(idx)
          }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isPlaying, setIsPlaying, jumpToScene, seekTo, scenes.length, currentSceneIndex])

  // Inyectar CSS
  useEffect(() => {
    const styleId = 'np-styles'
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = ANIMATION_CSS
    document.head.appendChild(style)
  }, [])

  return (
    <div className="np-stage">
      <div className="np-particles" ref={particlesContainerRef}></div>
      <div className="np-grain"></div>
      <div className="np-vignette"></div>

      {/* Escena 1: Logo */}
      <div
        className="np-scene np-scene-logo"
        id="scene-logo"
        ref={el => { sceneElementsRef.current['scene-logo'] = el }}
      >
        <div className="np-logo-rings">
          <div className="np-logo-ring" style={{ width: 1100, height: 1100 }}></div>
          <div className="np-logo-ring" style={{ width: 950, height: 950 }}></div>
        </div>
        <div className="np-logo-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="np-logo-img" src={CONFIG.images.logo} alt="Logo" />
          <div className="np-logo-shine"></div>
        </div>
        <div className="np-logo-text">
          <div className="np-logo-title">{CONFIG.texts.sceneLogo.title}</div>
          <div className="np-logo-subtitle">{CONFIG.couple.initials}</div>
        </div>
      </div>

      {/* Escenas de fotos */}
      {CONFIG.images.photos.map((photo, i) => {
        const caption = CONFIG.texts.scenePhotos[i] || { caption: '' }
        return (
          <div
            key={`photo-${i}`}
            className="np-scene np-photo-scene"
            id={`scene-photo-${i}`}
            ref={el => { sceneElementsRef.current[`scene-photo-${i}`] = el }}
          >
            <div className="np-photo-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="np-photo-img" src={photo} alt={`Foto ${i+1}`} />
              <div className="np-photo-overlay"></div>
            </div>
            <div className="np-photo-border">
              <div className="corner-tr"></div>
              <div className="corner-bl"></div>
            </div>
            <div className="np-photo-counter">
              <span className="current">{String(i+1).padStart(2,'0')}</span>
              <span> / </span>
              <span>{String(CONFIG.images.photos.length).padStart(2,'0')}</span>
            </div>
            {caption.caption && (
              <div className="np-photo-caption">
                <span className="divider"></span>
                <span className="text">{caption.caption}</span>
                <span className="divider"></span>
              </div>
            )}
          </div>
        )
      })}

      {/* Escena Final */}
      <div
        className="np-scene np-scene-final"
        id="scene-final"
        ref={el => { sceneElementsRef.current['scene-final'] = el }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="np-final-logo" src={CONFIG.images.logo} alt="Logo Final" />
        <div className="np-final-phrase">{CONFIG.texts.sceneFinal.phrase}</div>
        <div className="np-final-signature">{CONFIG.couple.initials}</div>
        {CONFIG.texts.sceneFinal.closing && (
          <div className="np-final-closing">{CONFIG.texts.sceneFinal.closing}</div>
        )}
      </div>

      {/* Barra de progreso */}
      <div
        className={`np-progress-bar ${hudVisible ? 'np-visible' : ''}`}
        style={{ width: `${progress}%` }}
      ></div>

      {/* HUD */}
      <div className={`np-hud ${hudVisible ? 'np-visible' : ''}`}>
        <h4>Controles</h4>
        <div className="row"><kbd>Space</kbd> {isPlaying ? 'Pausa' : 'Play'}</div>
        <div className="row"><kbd>←</kbd> <kbd>→</kbd> Escena anterior / siguiente</div>
        <div className="row"><kbd>1</kbd>-<kbd>9</kbd> Saltar a escena</div>
        <div className="row"><kbd>R</kbd> Reiniciar</div>
        <div className="row"><kbd>F</kbd> Pantalla completa</div>
        <div className="row"><kbd>?</kbd> Ocultar este panel</div>
        <div className="scene-info">
          <div><span className="label">Tiempo:</span> {currentTime.toFixed(2)}s / {totalDuration.toFixed(2)}s</div>
          <div><span className="label">Escena:</span> {activeSceneInfo?.id || '-'} ({activeSceneInfo?.type || '-'})</div>
          <div><span className="label">Progreso:</span> {progress.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}
