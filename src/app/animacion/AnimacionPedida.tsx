'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CONFIG } from './config'

// ============================================================
// Curvas de easing profesionales (estilo GSAP premium)
// ============================================================
const Easing = {
  inOutQuart: (t: number) => t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t + 2, 4) / 2,
  inOutQuint: (t: number) => t < 0.5 ? 16*t*t*t*t*t : 1 - Math.pow(-2*t + 2, 5) / 2,
  outExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10*t),
  inOutExpo: (t: number) => {
    if (t === 0 || t === 1) return t
    return t < 0.5
      ? Math.pow(2, 20*t - 10) / 2
      : (2 - Math.pow(2, -20*t + 10)) / 2
  },
  outBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
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
  twinkle: number
  twinkleFreq: number
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

  useEffect(() => {
    const tl = CONFIG.timeline
    const scenes: Scene[] = []
    let total = 0
    scenes.push({
      id: 'scene-logo', type: 'logo', duration: tl.logoIntro,
      start: total, end: total + tl.logoIntro,
      transitionIn: 1.8, transitionOut: 1.6
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
      transitionIn: 1.8, transitionOut: 1.4
    })
    total += tl.finalScene + tl.loopPause
    scenesRef.current = scenes
    totalDurationRef.current = total
  }, [])

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

  const getOpacities = useCallback(() => {
    return scenesRef.current.map(scene => {
      const tIn = scene.transitionIn
      const tOut = scene.transitionOut
      let opacity = 0
      if (currentTime < scene.start) {
        opacity = 0
      } else if (currentTime >= scene.start && currentTime < scene.start + tIn) {
        const t = (currentTime - scene.start) / tIn
        opacity = Easing.inOutQuint(t)
      } else if (currentTime >= scene.start + tIn && currentTime < scene.end - tOut) {
        opacity = 1
      } else if (currentTime >= scene.end - tOut && currentTime < scene.end) {
        const t = (currentTime - (scene.end - tOut)) / tOut
        opacity = 1 - Easing.inOutQuint(t)
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
// Sistema de partículas mejorado (con twinkle)
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
        vy: -(0.12 + Math.random() * 0.35) * opts.speed,
        amp: 20 + Math.random() * 70,
        freq: 0.0004 + Math.random() * 0.0009,
        phase: Math.random() * Math.PI * 2,
        baseOpacity: opts.minOpacity + Math.random() * (opts.maxOpacity - opts.minOpacity),
        opacityAmp: 0.15 + Math.random() * 0.35,
        opacityFreq: 0.0008 + Math.random() * 0.0018,
        opacityPhase: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.7,
        size,
        twinkle: Math.random() * Math.PI * 2,
        twinkleFreq: 0.002 + Math.random() * 0.004
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

        // Twinkle effect (parpadeo sutil)
        const twinkle = 0.6 + Math.sin(now * p.twinkleFreq + p.twinkle) * 0.4
        const opacity = (p.baseOpacity + Math.sin(now * p.opacityFreq + p.opacityPhase) * p.opacityAmp) * twinkle
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
// CSS premium con mejoras significativas
// ============================================================
const ANIMATION_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=Inter:wght@200;300;400;500&display=swap');

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #050505;
  font-family: 'Cormorant Garamond', serif;
  color: #F5EFE0;
  cursor: none;
}

.np-stage {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 50%, #1a1410 0%, #0a0707 55%, #000 100%);
  overflow: hidden;
  perspective: 1500px;
}

/* === Capas decorativas === */
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
  box-shadow:
    0 0 4px #D4AF37,
    0 0 10px rgba(212,175,55,0.5),
    0 0 20px rgba(212,175,55,0.2);
  pointer-events: none;
  will-change: transform, opacity;
}

/* Aurora sutil de fondo */
.np-aurora {
  position: absolute;
  inset: -10%;
  pointer-events: none;
  z-index: 0;
  opacity: 0.4;
  background:
    radial-gradient(circle at 20% 30%, rgba(212,175,55,0.08) 0%, transparent 35%),
    radial-gradient(circle at 80% 70%, rgba(180,140,90,0.06) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(212,175,55,0.04) 0%, transparent 50%);
  animation: npAurora 25s ease-in-out infinite;
  filter: blur(40px);
}
@keyframes npAurora {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  33% { transform: translate(2%, -1%) rotate(2deg) scale(1.05); }
  66% { transform: translate(-1%, 2%) rotate(-1deg) scale(0.95); }
}

.np-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  background: radial-gradient(ellipse at center,
    transparent 25%,
    rgba(0,0,0,0.35) 65%,
    rgba(0,0,0,0.8) 100%);
}

.np-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 49;
  opacity: 0.05;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* === Escenas === */
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
  perspective: 1200px;
  transform-style: preserve-3d;
}
.np-logo-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  filter:
    drop-shadow(0 0 30px rgba(212, 175, 55, 0.35))
    drop-shadow(0 0 60px rgba(212, 175, 55, 0.15));
}

/* Anillos decorativos que rotan */
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
  border: 1px solid rgba(212,175,55,0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.np-logo-ring-rotating {
  border-style: dashed;
  border-color: rgba(212,175,55,0.2);
  animation: npRingRotate 60s linear infinite;
}
@keyframes npRingRotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

/* Brillo que recorre el logo */
.np-logo-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(105deg,
    transparent 30%,
    rgba(212,175,55,0) 40%,
    rgba(212,175,55,0.35) 50%,
    rgba(255,225,150,0.65) 55%,
    rgba(212,175,55,0.35) 60%,
    rgba(212,175,55,0) 70%,
    transparent 80%);
  transform: skewX(-15deg);
  pointer-events: none;
  mix-blend-mode: screen;
}

/* Texto bajo el logo */
.np-logo-text {
  margin-top: 50px;
  text-align: center;
  position: relative;
}
.np-logo-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(28px, 3vw, 52px);
  font-weight: 300;
  letter-spacing: 0.6em;
  color: #D4AF37;
  text-transform: uppercase;
  text-shadow:
    0 0 20px rgba(212,175,55,0.5),
    0 0 40px rgba(212,175,55,0.2);
  margin-left: 0.6em;
  background: linear-gradient(180deg, #F5D880 0%, #D4AF37 50%, #A8862A 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.np-logo-subtitle {
  margin-top: 28px;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(22px, 2.2vw, 38px);
  letter-spacing: 0.4em;
  color: #F5EFE0;
  font-style: italic;
  font-weight: 300;
  margin-left: 0.4em;
}
.np-logo-ornament {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 28px;
  opacity: 0.7;
}
.np-logo-ornament .line {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #D4AF37, transparent);
}
.np-logo-ornament .diamond {
  width: 6px;
  height: 6px;
  background: #D4AF37;
  transform: rotate(45deg);
  box-shadow: 0 0 8px #D4AF37;
}

/* === Escenas de fotos === */
.np-photo-scene { flex-direction: column; }
.np-photo-frame {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.np-photo-img {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  object-fit: cover;
  will-change: transform;
  filter: brightness(0.82) contrast(1.08) saturate(0.92);
}

/* Overlay con doble gradiente para legibilidad premium */
.np-photo-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to bottom,
      rgba(0,0,0,0.4) 0%,
      rgba(0,0,0,0) 25%,
      rgba(0,0,0,0) 55%,
      rgba(0,0,0,0.5) 80%,
      rgba(0,0,0,0.85) 100%),
    linear-gradient(to right,
      rgba(0,0,0,0.25) 0%,
      rgba(0,0,0,0) 30%,
      rgba(0,0,0,0) 70%,
      rgba(0,0,0,0.25) 100%);
  pointer-events: none;
  z-index: 2;
}

/* Marco dorado elegante */
.np-photo-border {
  position: absolute;
  top: 5vh;
  left: 5vw;
  right: 5vw;
  bottom: 5vh;
  border: 1px solid rgba(212,175,55,0.35);
  pointer-events: none;
  z-index: 5;
  box-shadow:
    inset 0 0 0 1px rgba(0,0,0,0.3),
    inset 0 0 100px rgba(0,0,0,0.5),
    inset 0 0 200px rgba(0,0,0,0.3);
}
.np-photo-border::before,
.np-photo-border::after,
.np-photo-border .corner-tr,
.np-photo-border .corner-bl {
  content: '';
  position: absolute;
  width: 70px;
  height: 70px;
  border: 2px solid #D4AF37;
  filter: drop-shadow(0 0 4px rgba(212,175,55,0.5));
}
.np-photo-border::before { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.np-photo-border::after { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.np-photo-border .corner-tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.np-photo-border .corner-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }

/* Caption centrado */
.np-photo-caption {
  position: absolute;
  bottom: 14vh;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 6;
  white-space: nowrap;
}
.np-photo-caption .divider {
  display: inline-block;
  width: 70px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #D4AF37, transparent);
  vertical-align: middle;
  margin: 0 30px;
}
.np-photo-caption .text {
  display: inline-block;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(26px, 2.6vw, 48px);
  letter-spacing: 0.45em;
  color: #D4AF37;
  text-transform: uppercase;
  vertical-align: middle;
  text-shadow:
    0 0 30px rgba(0,0,0,0.95),
    0 2px 8px rgba(0,0,0,0.8),
    0 0 20px rgba(212,175,55,0.3);
  margin-left: 0.45em;
  background: linear-gradient(180deg, #F5D880 0%, #D4AF37 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 400;
}

/* === Escena Final === */
.np-scene-final { flex-direction: column; }
.np-final-logo {
  width: min(500px, 35vw);
  height: auto;
  object-fit: contain;
  filter:
    drop-shadow(0 0 40px rgba(212, 175, 55, 0.5))
    drop-shadow(0 0 80px rgba(212, 175, 55, 0.2));
}
.np-final-phrase {
  margin-top: 60px;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(38px, 4.2vw, 68px);
  font-style: italic;
  font-weight: 400;
  color: #D4AF37;
  text-shadow: 0 0 30px rgba(212,175,55,0.5);
  text-align: center;
  letter-spacing: 0.02em;
  background: linear-gradient(180deg, #F5D880 0%, #D4AF37 50%, #A8862A 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.np-final-signature {
  margin-top: 32px;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(22px, 2vw, 34px);
  letter-spacing: 0.7em;
  color: #F5EFE0;
  text-transform: uppercase;
  margin-left: 0.7em;
  font-weight: 300;
}
.np-final-closing {
  margin-top: 60px;
  font-family: 'Inter', sans-serif;
  font-size: clamp(11px, 0.9vw, 13px);
  letter-spacing: 0.6em;
  color: rgba(245,239,224,0.5);
  text-transform: uppercase;
  margin-left: 0.6em;
  font-weight: 300;
}
.np-final-ornament {
  margin-top: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  opacity: 0.6;
}
.np-final-ornament .line {
  width: 80px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #D4AF37, transparent);
}
.np-final-ornament .diamond {
  width: 8px;
  height: 8px;
  background: #D4AF37;
  transform: rotate(45deg);
  box-shadow: 0 0 10px #D4AF37;
}

/* === HUD === */
.np-hud {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 100;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  color: rgba(245,239,224,0.7);
  background: rgba(0, 0, 0, 0.75);
  padding: 14px 18px;
  border-radius: 10px;
  border: 1px solid rgba(212, 175, 55, 0.25);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.np-hud.np-visible { opacity: 1; pointer-events: auto; }
.np-hud h4 {
  color: #D4AF37;
  font-size: 10px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  margin: 0 0 10px 0;
  font-weight: 500;
}
.np-hud kbd {
  display: inline-block;
  padding: 2px 7px;
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 3px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 10px;
  color: #F5EFE0;
  margin-right: 6px;
}
.np-hud .row { margin: 5px 0; }
.np-hud .scene-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(212, 175, 55, 0.15);
  font-size: 12px;
  color: #F5EFE0;
}
.np-hud .scene-info .label {
  color: rgba(245,239,224,0.5);
  margin-right: 8px;
}

/* === Barra de progreso === */
.np-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(212,175,55,0.4) 20%,
    #D4AF37 50%,
    rgba(212,175,55,0.4) 80%,
    transparent 100%);
  z-index: 99;
  width: 0%;
  opacity: 0;
  transition: opacity 0.3s;
  box-shadow: 0 0 8px rgba(212,175,55,0.5);
}
.np-progress-bar.np-visible { opacity: 0.9; }

/* === Cursor personalizado === */
.np-cursor {
  position: fixed;
  width: 14px;
  height: 14px;
  border: 1px solid rgba(212,175,55,0.5);
  border-radius: 50%;
  pointer-events: none;
  z-index: 200;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.3s, width 0.2s, height 0.2s;
  mix-blend-mode: difference;
}
.np-cursor.np-visible { opacity: 0.6; }

/* === Keyframes === */
@keyframes npLogoAppear {
  0% {
    opacity: 0;
    transform: scale(0.82) translateY(30px) rotateX(15deg);
    filter: blur(20px) drop-shadow(0 0 0 rgba(212, 175, 55, 0));
  }
  40% {
    opacity: 0.4;
    filter: blur(8px) drop-shadow(0 0 20px rgba(212, 175, 55, 0.2));
  }
  75% {
    opacity: 0.9;
    transform: scale(1.03) translateY(-5px) rotateX(-3deg);
    filter: blur(0) drop-shadow(0 0 30px rgba(212, 175, 55, 0.3));
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0) rotateX(0);
    filter: blur(0) drop-shadow(0 0 30px rgba(212, 175, 55, 0.35));
  }
}
@keyframes npShineSweep {
  0% { left: -100%; opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { left: 200%; opacity: 0; }
}
@keyframes npRingExpand {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  40% { opacity: 0.8; }
  100% { opacity: 0.2; transform: translate(-50%, -50%) scale(1); }
}
@keyframes npTextRise {
  0% { opacity: 0; transform: translateY(30px); letter-spacing: 0.15em; filter: blur(8px); }
  60% { opacity: 0.9; filter: blur(0); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes npOrnamentRise {
  0% { opacity: 0; transform: translateY(20px) scaleX(0.5); }
  100% { opacity: 0.7; transform: translateY(0) scaleX(1); }
}

/* Variaciones de Ken Burns más cinematográficas */
@keyframes npKenBurnsA {
  0% { transform: scale(1.0) translate(0, 0); filter: brightness(0.7); }
  30% { filter: brightness(0.85); }
  100% { transform: scale(1.18) translate(-2.5%, -1.5%); filter: brightness(0.95); }
}
@keyframes npKenBurnsB {
  0% { transform: scale(1.22) translate(2.5%, 1.5%); filter: brightness(0.95); }
  70% { filter: brightness(0.85); }
  100% { transform: scale(1.0) translate(0, 0); filter: brightness(0.7); }
}
@keyframes npKenBurnsC {
  0% { transform: scale(1.05) translate(0, 2.5%); filter: brightness(0.75); }
  50% { filter: brightness(0.9); }
  100% { transform: scale(1.22) translate(0, -2.5%); filter: brightness(0.95); }
}
@keyframes npKenBurnsD {
  0% { transform: scale(1.0) translate(2.5%, -1%) rotate(0.5deg); filter: brightness(0.7); }
  100% { transform: scale(1.15) translate(-2.5%, 1.5%) rotate(0deg); filter: brightness(0.95); }
}
@keyframes npKenBurnsE {
  0% { transform: scale(1.18) translate(-1.5%, 1%) rotate(-0.5deg); filter: brightness(0.95); }
  100% { transform: scale(1.0) translate(1.5%, 0) rotate(0deg); filter: brightness(0.7); }
}

@keyframes npCaptionRise {
  0% {
    opacity: 0;
    transform: translate(-50%, 40px);
    filter: blur(12px);
    letter-spacing: 0.6em;
  }
  60% {
    opacity: 0.9;
    filter: blur(2px);
    letter-spacing: 0.5em;
  }
  100% {
    opacity: 1;
    transform: translate(-50%, 0);
    filter: blur(0);
    letter-spacing: 0.45em;
  }
}

@keyframes npFinalLogoIn {
  0% {
    opacity: 0;
    transform: scale(0.88) translateY(30px) rotateY(10deg);
    filter: blur(15px);
  }
  60% {
    opacity: 0.85;
    filter: blur(3px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0) rotateY(0);
    filter: blur(0);
  }
}
@keyframes npPhraseIn {
  0% { opacity: 0; transform: translateY(40px); filter: blur(8px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}

/* Respiración sutil del logo final */
@keyframes npBreathe {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 40px rgba(212,175,55,0.4)); }
  50% { transform: scale(1.02); filter: drop-shadow(0 0 60px rgba(212,175,55,0.6)); }
}
.np-final-logo-breathing {
  animation: npBreathe 4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
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
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })

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

  // Cursor personalizado
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY })
    }
    if (hudVisible) {
      document.addEventListener('mousemove', handleMouseMove)
    }
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [hudVisible])

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
        caption.style.animation = 'npCaptionRise 1.4s ease-out 0.6s forwards'
      }
    } else if (scene.type === 'logo') {
      const logoImg = el.querySelector('.np-logo-img') as HTMLImageElement
      const shine = el.querySelector('.np-logo-shine') as HTMLElement
      const title = el.querySelector('.np-logo-title') as HTMLElement
      const subtitle = el.querySelector('.np-logo-subtitle') as HTMLElement
      const ornament = el.querySelector('.np-logo-ornament') as HTMLElement
      const rings = el.querySelectorAll('.np-logo-ring')
      ;[logoImg, shine, title, subtitle, ornament].forEach(elem => {
        if (elem) { elem.style.animation = 'none'; void elem.offsetHeight }
      })
      if (logoImg) logoImg.style.animation = 'npLogoAppear 3.2s ease-out 0.3s forwards'
      if (shine) shine.style.animation = 'npShineSweep 3.5s ease-in-out 2s forwards'
      if (title) title.style.animation = 'npTextRise 1.8s ease-out 1.3s forwards'
      if (subtitle) subtitle.style.animation = 'npTextRise 1.8s ease-out 1.9s forwards'
      if (ornament) ornament.style.animation = 'npOrnamentRise 1.5s ease-out 2.5s forwards'
      rings.forEach((r, i) => {
        r.style.animation = 'none'
        void r.offsetHeight
        r.style.animation = `npRingExpand 3.5s ease-out ${0.8 + i * 0.3}s forwards`
      })
    } else if (scene.type === 'final') {
      const logo = el.querySelector('.np-final-logo') as HTMLImageElement
      const phrase = el.querySelector('.np-final-phrase') as HTMLElement
      const signature = el.querySelector('.np-final-signature') as HTMLElement
      const closing = el.querySelector('.np-final-closing') as HTMLElement
      const ornament = el.querySelector('.np-final-ornament') as HTMLElement
      ;[logo, phrase, signature, closing, ornament].forEach(elem => {
        if (elem) { elem.style.animation = 'none'; void elem.offsetHeight }
      })
      if (logo) {
        logo.style.animation = 'npFinalLogoIn 2.2s ease-out 0.3s forwards, npBreathe 4s ease-in-out 2.5s infinite'
      }
      if (phrase) phrase.style.animation = 'npPhraseIn 2s ease-out 1.5s forwards'
      if (signature) signature.style.animation = 'npPhraseIn 2s ease-out 2.3s forwards'
      if (ornament) ornament.style.animation = 'npOrnamentRise 1.5s ease-out 3s forwards'
      if (closing) closing.style.animation = 'npPhraseIn 1.5s ease-out 3.5s forwards'
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
      {/* Capas decorativas */}
      <div className="np-aurora"></div>
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
          <div className="np-logo-ring np-logo-ring-rotating" style={{ width: 950, height: 950 }}></div>
          <div className="np-logo-ring" style={{ width: 800, height: 800 }}></div>
        </div>
        <div className="np-logo-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="np-logo-img" src={CONFIG.images.logo} alt="Logo" />
          <div className="np-logo-shine"></div>
        </div>
        <div className="np-logo-text">
          <div className="np-logo-title">{CONFIG.texts.sceneLogo.title}</div>
          <div className="np-logo-subtitle">{CONFIG.couple.initials}</div>
          <div className="np-logo-ornament">
            <div className="line"></div>
            <div className="diamond"></div>
            <div className="line"></div>
          </div>
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
        <div className="np-final-ornament">
          <div className="line"></div>
          <div className="diamond"></div>
          <div className="line"></div>
        </div>
        {CONFIG.texts.sceneFinal.closing && (
          <div className="np-final-closing">{CONFIG.texts.sceneFinal.closing}</div>
        )}
      </div>

      {/* Barra de progreso */}
      <div
        className={`np-progress-bar ${hudVisible ? 'np-visible' : ''}`}
        style={{ width: `${progress}%` }}
      ></div>

      {/* Cursor personalizado */}
      <div
        className={`np-cursor ${hudVisible ? 'np-visible' : ''}`}
        style={{ left: cursorPos.x, top: cursorPos.y }}
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
