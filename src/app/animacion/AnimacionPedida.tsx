'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CONFIG } from './config'
import { fetchGallery, uploadFilesSmart, deleteFile, updateImageSettings, type GalleryItem, type ImageSettings } from './gallery'

// ============================================================
// Curvas de easing profesionales
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
type SceneType = 'logo' | 'photo' | 'video' | 'final'

interface Scene {
  id: string
  type: SceneType
  duration: number
  start: number
  end: number
  transitionIn: number
  transitionOut: number
  mediaIndex?: number
  mediaItem?: GalleryItem
  caption?: string
}

interface Particle {
  x: number; y: number; vy: number; amp: number; freq: number; phase: number
  baseOpacity: number; opacityAmp: number; opacityFreq: number; opacityPhase: number
  depth: number; size: number; twinkle: number; twinkleFreq: number
}

// ============================================================
// Hook del timeline dinámico con shuffle aleatorio y videos hasta el final
// ============================================================

// Función Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function useTimeline(
  galleryItems: GalleryItem[],
  videoDurations: Record<string, number>,  // filename -> duración real del video en segundos
  onVideoEndsEarly: ((sceneId: string) => void) | null
) {
  const scenesRef = useRef<Scene[]>([])
  const totalDurationRef = useRef(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(true)
  const [loopCount, setLoopCount] = useState(0)  // se incrementa en cada loop
  const lastTimeRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const onSceneChangeRef = useRef<((scene: Scene, index: number) => void) | null>(null)
  const isPlayingRef = useRef(isPlaying)
  const speedRef = useRef(CONFIG.style.speed || 1)
  const videoDurationsRef = useRef(videoDurations)
  const onVideoEndsEarlyRef = useRef(onVideoEndsEarly)

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { videoDurationsRef.current = videoDurations }, [videoDurations])
  useEffect(() => { onVideoEndsEarlyRef.current = onVideoEndsEarly }, [onVideoEndsEarly])

  // Construir timeline dinámicamente según los items de la galería
  // Se reconstruye en cada loop para aleatorizar el orden
  useEffect(() => {
    const tl = CONFIG.timeline
    const scenes: Scene[] = []
    let total = 0

    // Escena 1: Logo intro (siempre primera, solo en loop 0)
    if (loopCount === 0) {
      scenes.push({
        id: 'scene-logo', type: 'logo', duration: tl.logoIntro,
        start: total, end: total + tl.logoIntro,
        transitionIn: 1.8, transitionOut: 1.6
      })
      total += tl.logoIntro
    }

    // Escenas dinámicas con ORDEN ALEATORIO en cada loop
    const shuffledItems = shuffle(galleryItems)
    shuffledItems.forEach((item, i) => {
      const isVideo = item.type === 'video'
      // Para videos: usar duración real si está disponible, sino tl.videoDuration
      const realDuration = isVideo && videoDurations[item.filename]
        ? videoDurations[item.filename] + tl.photoTransition  // transición extra
        : (isVideo ? tl.videoDuration : tl.photoDuration)
      const duration = realDuration
      scenes.push({
        id: `scene-media-${loopCount}-${i}`,
        type: isVideo ? 'video' : 'photo',
        mediaIndex: i,
        mediaItem: item,
        caption: item.caption,
        duration,
        start: total,
        end: total + duration,
        transitionIn: tl.photoTransition,
        transitionOut: tl.photoTransition
      })
      total += duration
    })

    // Escena final (siempre al final, solo en loop 0)
    if (loopCount === 0) {
      scenes.push({
        id: 'scene-final', type: 'final', duration: tl.finalScene,
        start: total, end: total + tl.finalScene,
        transitionIn: 1.8, transitionOut: 1.4
      })
      total += tl.finalScene + tl.loopPause
    } else {
      total += tl.loopPause
    }

    scenesRef.current = scenes
    totalDurationRef.current = total
  }, [galleryItems, loopCount, videoDurations])

  // Loop principal con detección de fin de video
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
          if (next >= total) {
            // Loop completo: incrementar loopCount para re-shuffle
            setLoopCount(c => c + 1)
            next = 0
          }
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

  // Reset currentTime cuando cambia loopCount
  useEffect(() => {
    if (loopCount > 0) {
      setCurrentTime(0)
      setCurrentSceneIndex(-1)
    }
  }, [loopCount])

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

  // Función para saltar a la siguiente escena (usada cuando un video termina antes)
  const skipToNextScene = useCallback(() => {
    const scenes = scenesRef.current
    if (currentSceneIndex < scenes.length - 1) {
      const nextScene = scenes[currentSceneIndex + 1]
      setCurrentTime(nextScene.start + 0.05)
      setCurrentSceneIndex(-1)
    }
  }, [currentSceneIndex])

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
    skipToNextScene,
    onSceneChangeRef,
    loopCount
  }
}

// ============================================================
// Sistema de partículas
// ============================================================
function useParticles(containerRef: React.RefObject<HTMLDivElement | null>) {
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
        x: Math.random() * w, y: Math.random() * h,
        vy: -(0.12 + Math.random() * 0.35) * opts.speed,
        amp: 20 + Math.random() * 70,
        freq: 0.0004 + Math.random() * 0.0009,
        phase: Math.random() * Math.PI * 2,
        baseOpacity: opts.minOpacity + Math.random() * (opts.maxOpacity - opts.minOpacity),
        opacityAmp: 0.15 + Math.random() * 0.35,
        opacityFreq: 0.0008 + Math.random() * 0.0018,
        opacityPhase: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.7, size,
        twinkle: Math.random() * Math.PI * 2,
        twinkleFreq: 0.002 + Math.random() * 0.004
      })
    }

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
// CSS
// ============================================================
const ANIMATION_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=Inter:wght@200;300;400;500&display=swap');

* { box-sizing: border-box; }

html, body {
  margin: 0; padding: 0; overflow: hidden;
  background: #050505;
  font-family: 'Cormorant Garamond', serif;
  color: #F5EFE0;
  cursor: none;
}

/* === Cursor elegante personalizado === */
.np-cursor-dot {
  position: fixed;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #D4AF37;
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, -50%);
  box-shadow:
    0 0 8px #D4AF37,
    0 0 16px rgba(212, 175, 55, 0.6),
    0 0 24px rgba(212, 175, 55, 0.3);
  transition: width 0.2s, height 0.2s, opacity 0.2s;
}
.np-cursor-ring {
  position: fixed;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(212, 175, 55, 0.6);
  border-radius: 50%;
  pointer-events: none;
  z-index: 9998;
  transform: translate(-50%, -50%);
  transition: transform 0.15s ease-out, width 0.2s, height 0.2s, opacity 0.2s, border-color 0.2s;
}
.np-cursor-ring.np-hover {
  width: 56px;
  height: 56px;
  border-color: #D4AF37;
  background: rgba(212, 175, 55, 0.08);
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
}

.np-stage {
  position: fixed; inset: 0;
  background: radial-gradient(ellipse 80% 60% at 50% 50%, #1a1410 0%, #0a0707 55%, #000 100%);
  overflow: hidden; perspective: 1500px;
}

.np-particles { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.np-particle {
  position: absolute; border-radius: 50%;
  background: #D4AF37;
  box-shadow: 0 0 4px #D4AF37, 0 0 10px rgba(212,175,55,0.5), 0 0 20px rgba(212,175,55,0.2);
  pointer-events: none; will-change: transform, opacity;
}

.np-aurora {
  position: absolute; inset: -10%; pointer-events: none; z-index: 0; opacity: 0.4;
  background:
    radial-gradient(circle at 20% 30%, rgba(212,175,55,0.08) 0%, transparent 35%),
    radial-gradient(circle at 80% 70%, rgba(180,140,90,0.06) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(212,175,55,0.04) 0%, transparent 50%);
  animation: npAurora 25s ease-in-out infinite; filter: blur(40px);
}
@keyframes npAurora {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  33% { transform: translate(2%, -1%) rotate(2deg) scale(1.05); }
  66% { transform: translate(-1%, 2%) rotate(-1deg) scale(0.95); }
}

.np-vignette {
  position: absolute; inset: 0; pointer-events: none; z-index: 50;
  background: radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.8) 100%);
}

.np-grain {
  position: absolute; inset: 0; pointer-events: none; z-index: 49;
  opacity: 0.05; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.np-scene {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  opacity: 0; z-index: 2; pointer-events: none; will-change: opacity, transform;
}
.np-scene-active { z-index: 3; }

/* === Escena Logo === */
.np-scene-logo { flex-direction: column; gap: 0; }
.np-logo-container {
  position: relative; width: min(900px, 50vw); height: auto;
  display: flex; align-items: center; justify-content: center;
  perspective: 1200px; transform-style: preserve-3d;
}
.np-logo-img {
  width: 100%; height: auto; object-fit: contain;
  filter: drop-shadow(0 0 30px rgba(212, 175, 55, 0.35)) drop-shadow(0 0 60px rgba(212, 175, 55, 0.15));
}
.np-logo-rings {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%); pointer-events: none; z-index: -1;
}
.np-logo-ring {
  position: absolute; top: 50%; left: 50%;
  border: 1px solid rgba(212,175,55,0.3); border-radius: 50%;
  transform: translate(-50%, -50%);
}
.np-logo-ring-rotating {
  border-style: dashed; border-color: rgba(212,175,55,0.2);
  animation: npRingRotate 60s linear infinite;
}
@keyframes npRingRotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
.np-logo-shine {
  position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(105deg, transparent 30%, rgba(212,175,55,0) 40%, rgba(212,175,55,0.35) 50%, rgba(255,225,150,0.65) 55%, rgba(212,175,55,0.35) 60%, rgba(212,175,55,0) 70%, transparent 80%);
  transform: skewX(-15deg); pointer-events: none; mix-blend-mode: screen;
}
.np-logo-text { margin-top: 50px; text-align: center; position: relative; }
.np-logo-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(28px, 3vw, 52px); font-weight: 300; letter-spacing: 0.6em;
  text-transform: uppercase; margin-left: 0.6em;
  text-shadow: 0 0 20px rgba(212,175,55,0.5), 0 0 40px rgba(212,175,55,0.2);
  background: linear-gradient(180deg, #F5D880 0%, #D4AF37 50%, #A8862A 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.np-logo-subtitle {
  margin-top: 28px; font-family: 'Cormorant Garamond', serif;
  font-size: clamp(22px, 2.2vw, 38px); letter-spacing: 0.4em;
  color: #F5EFE0; font-style: italic; font-weight: 300; margin-left: 0.4em;
}
.np-logo-ornament {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin-top: 28px; opacity: 0.7;
}
.np-logo-ornament .line { width: 60px; height: 1px; background: linear-gradient(90deg, transparent, #D4AF37, transparent); }
.np-logo-ornament .diamond { width: 6px; height: 6px; background: #D4AF37; transform: rotate(45deg); box-shadow: 0 0 8px #D4AF37; }

/* === Escenas de media (foto/video) === */
.np-media-scene { flex-direction: column; }
.np-media-frame { position: absolute; inset: 0; overflow: hidden; }
.np-media-img, .np-media-video {
  position: absolute; inset: -10%; width: 120%; height: 120%;
  object-fit: cover; will-change: transform;
  filter: brightness(0.82) contrast(1.08) saturate(0.92);
  object-position: center 30%;  /* Prioriza la parte superior (rostros) */
}
.np-media-video {
  inset: 0; width: 100%; height: 100%;
  object-position: center center;
}
.np-media-overlay {
  position: absolute; inset: 0;
  background:
    linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 80%, rgba(0,0,0,0.85) 100%),
    linear-gradient(to right, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.25) 100%);
  pointer-events: none; z-index: 2;
}
.np-media-border {
  position: absolute; top: 5vh; left: 5vw; right: 5vw; bottom: 5vh;
  border: 1px solid rgba(212,175,55,0.35);
  pointer-events: none; z-index: 5;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.3), inset 0 0 100px rgba(0,0,0,0.5), inset 0 0 200px rgba(0,0,0,0.3);
}
.np-media-border::before, .np-media-border::after,
.np-media-border .corner-tr, .np-media-border .corner-bl {
  content: ''; position: absolute; width: 70px; height: 70px;
  border: 2px solid #D4AF37; filter: drop-shadow(0 0 4px rgba(212,175,55,0.5));
}
.np-media-border::before { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.np-media-border::after { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.np-media-border .corner-tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.np-media-border .corner-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }

.np-media-caption {
  position: absolute; bottom: 14vh; left: 50%;
  transform: translateX(-50%); text-align: center; z-index: 6; white-space: nowrap;
}
.np-media-caption .divider {
  display: inline-block; width: 70px; height: 1px;
  background: linear-gradient(90deg, transparent, #D4AF37, transparent);
  vertical-align: middle; margin: 0 30px;
}
.np-media-caption .text {
  display: inline-block; font-family: 'Cormorant Garamond', serif;
  font-size: clamp(26px, 2.6vw, 48px); letter-spacing: 0.45em;
  text-transform: uppercase; vertical-align: middle;
  text-shadow: 0 0 30px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(212,175,55,0.3);
  margin-left: 0.45em;
  background: linear-gradient(180deg, #F5D880 0%, #D4AF37 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  font-weight: 400;
}

/* === Escena Final === */
.np-scene-final { flex-direction: column; }
.np-final-logo {
  width: min(500px, 35vw); height: auto; object-fit: contain;
  filter: drop-shadow(0 0 40px rgba(212, 175, 55, 0.5)) drop-shadow(0 0 80px rgba(212, 175, 55, 0.2));
}
.np-final-phrase {
  margin-top: 60px; font-family: 'Cormorant Garamond', serif;
  font-size: clamp(38px, 4.2vw, 68px); font-style: italic; font-weight: 400;
  text-shadow: 0 0 30px rgba(212,175,55,0.5); text-align: center; letter-spacing: 0.02em;
  background: linear-gradient(180deg, #F5D880 0%, #D4AF37 50%, #A8862A 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.np-final-signature {
  margin-top: 32px; font-family: 'Cormorant Garamond', serif;
  font-size: clamp(22px, 2vw, 34px); letter-spacing: 0.7em;
  color: #F5EFE0; text-transform: uppercase; margin-left: 0.7em; font-weight: 300;
}
.np-final-closing {
  margin-top: 60px; font-family: 'Inter', sans-serif;
  font-size: clamp(11px, 0.9vw, 13px); letter-spacing: 0.6em;
  color: rgba(245,239,224,0.5); text-transform: uppercase; margin-left: 0.6em; font-weight: 300;
}
.np-final-ornament {
  margin-top: 40px; display: flex; align-items: center; justify-content: center;
  gap: 20px; opacity: 0.6;
}
.np-final-ornament .line { width: 80px; height: 1px; background: linear-gradient(90deg, transparent, #D4AF37, transparent); }
.np-final-ornament .diamond { width: 8px; height: 8px; background: #D4AF37; transform: rotate(45deg); box-shadow: 0 0 10px #D4AF37; }

/* === Botón de Upload === */
.np-upload-btn {
  position: fixed; top: 24px; right: 24px; z-index: 101;
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.5);
  color: #D4AF37; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-family: 'Inter', sans-serif; font-weight: 200;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  opacity: 0.4;
}
.np-upload-btn:hover {
  opacity: 1;
  background: rgba(212, 175, 55, 0.2);
  border-color: #D4AF37;
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.4);
}
.np-upload-btn.uploading {
  animation: npPulse 1s ease-in-out infinite;
}
@keyframes npPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.5); }
  50% { box-shadow: 0 0 0 15px rgba(212, 175, 55, 0); }
}

/* === Modal de gestión de archivos === */
.np-modal-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.np-modal-backdrop.np-visible { opacity: 1; pointer-events: auto; }
.np-modal {
  background: linear-gradient(180deg, #1a1410 0%, #0a0707 100%);
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 16px;
  padding: 32px;
  max-width: 720px; width: 90vw;
  max-height: 85vh; overflow-y: auto;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 60px rgba(212,175,55,0.15);
}
.np-modal h2 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 32px; font-weight: 400; color: #D4AF37;
  margin: 0 0 8px 0; letter-spacing: 0.05em;
  background: linear-gradient(180deg, #F5D880 0%, #D4AF37 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.np-modal .subtitle {
  color: rgba(245,239,224,0.6); font-size: 14px; margin-bottom: 24px;
  letter-spacing: 0.05em;
}
.np-modal .stats {
  display: flex; gap: 16px; margin-bottom: 24px;
  padding: 16px; background: rgba(0,0,0,0.4); border-radius: 8px;
  border: 1px solid rgba(212,175,55,0.15);
}
.np-modal .stat {
  flex: 1; text-align: center;
}
.np-modal .stat .num {
  font-size: 28px; color: #D4AF37; font-weight: 500;
  font-family: 'Cormorant Garamond', serif;
}
.np-modal .stat .label {
  font-size: 11px; color: rgba(245,239,224,0.5);
  text-transform: uppercase; letter-spacing: 0.2em; margin-top: 4px;
}
.np-dropzone {
  border: 2px dashed rgba(212, 175, 55, 0.4);
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
  margin-bottom: 20px;
  background: rgba(212, 175, 55, 0.03);
}
.np-dropzone:hover, .np-dropzone.dragover {
  border-color: #D4AF37;
  background: rgba(212, 175, 55, 0.1);
  transform: scale(1.01);
}
.np-dropzone .icon {
  font-size: 48px; color: #D4AF37; margin-bottom: 12px;
  font-weight: 200; line-height: 1;
}
.np-dropzone .text {
  color: #F5EFE0; font-size: 16px; margin-bottom: 4px;
}
.np-dropzone .hint {
  color: rgba(245,239,224,0.5); font-size: 12px;
}
.np-file-list {
  margin-top: 20px;
  max-height: 280px; overflow-y: auto;
  border-radius: 8px;
  border: 1px solid rgba(212,175,55,0.15);
}
.np-file-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(212,175,55,0.08);
  transition: background 0.2s;
}
.np-file-item:last-child { border-bottom: none; }
.np-file-item:hover { background: rgba(212, 175, 55, 0.05); }
.np-file-item .thumb {
  width: 50px; height: 36px; border-radius: 4px;
  object-fit: cover;
  background: rgba(212,175,55,0.1);
  border: 1px solid rgba(212,175,55,0.2);
}
.np-file-item .info { flex: 1; min-width: 0; }
.np-file-item .name {
  color: #F5EFE0; font-size: 13px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.np-file-item .meta {
  color: rgba(245,239,224,0.5); font-size: 11px; margin-top: 2px;
}
.np-file-item .badge {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
  background: rgba(212, 175, 55, 0.15); color: #D4AF37;
  border: 1px solid rgba(212, 175, 55, 0.3);
}
.np-file-item .badge.video {
  background: rgba(180, 80, 80, 0.15); color: #ffaaaa;
  border-color: rgba(180, 80, 80, 0.3);
}
.np-file-item .delete-btn {
  background: transparent; border: none; color: rgba(245,239,224,0.4);
  cursor: pointer; padding: 6px 10px; border-radius: 4px;
  font-size: 18px; transition: all 0.2s;
}
.np-file-item .delete-btn:hover {
  color: #ff6666; background: rgba(255, 100, 100, 0.1);
}
.np-file-item .edit-btn {
  background: transparent; border: 1px solid rgba(212,175,55,0.4);
  color: #D4AF37; cursor: pointer;
  padding: 4px 10px; border-radius: 4px;
  font-size: 11px; transition: all 0.2s;
  font-family: 'Inter', sans-serif; letter-spacing: 0.1em;
  text-transform: uppercase;
}
.np-file-item .edit-btn:hover {
  background: rgba(212,175,55,0.15);
  border-color: #D4AF37;
}

/* === Barra de progreso de upload === */
.np-upload-progress {
  position: fixed; bottom: 30px; left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.9);
  border: 1px solid #D4AF37;
  padding: 16px 24px;
  border-radius: 12px;
  z-index: 250;
  min-width: 320px;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 30px rgba(212,175,55,0.2);
}
.np-upload-progress .label {
  color: #F5EFE0; font-size: 13px;
  margin-bottom: 10px;
  display: flex; justify-content: space-between;
}
.np-upload-progress .label .percent { color: #D4AF37; }
.np-upload-progress .bar {
  width: 100%; height: 6px;
  background: rgba(212,175,55,0.15);
  border-radius: 3px;
  overflow: hidden;
}
.np-upload-progress .bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #D4AF37, #F5D880);
  border-radius: 3px;
  transition: width 0.3s ease-out;
  box-shadow: 0 0 8px rgba(212,175,55,0.6);
}

/* === Editor de imagen === */
.np-editor-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.92);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.np-editor-overlay.np-visible { opacity: 1; pointer-events: auto; }
.np-editor {
  background: linear-gradient(180deg, #1a1410 0%, #0a0707 100%);
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 16px;
  padding: 24px;
  width: 95vw; max-width: 1100px;
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 60px rgba(212,175,55,0.15);
}
.np-editor-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.np-editor-header h2 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 24px; font-weight: 400; color: #D4AF37;
  margin: 0; letter-spacing: 0.05em;
  background: linear-gradient(180deg, #F5D880 0%, #D4AF37 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.np-editor-header .close-btn {
  background: transparent; border: 1px solid rgba(212,175,55,0.3);
  color: rgba(245,239,224,0.6); cursor: pointer;
  width: 32px; height: 32px; border-radius: 50%;
  font-size: 18px; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.np-editor-header .close-btn:hover {
  border-color: #D4AF37; color: #D4AF37;
}
.np-editor-body {
  display: flex; gap: 20px; flex: 1;
  min-height: 0;
}
.np-editor-canvas {
  flex: 1;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  display: flex; align-items: center; justify-content: center;
  cursor: grab;
  user-select: none;
  border: 1px solid rgba(212,175,55,0.2);
}
.np-editor-canvas:active { cursor: grabbing; }
.np-editor-canvas img {
  max-width: 100%; max-height: 100%;
  display: block;
  transform-origin: center center;
  pointer-events: none;
  will-change: transform;
}
.np-editor-canvas .hint {
  position: absolute;
  bottom: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.7);
  color: rgba(245,239,224,0.7);
  padding: 6px 12px; border-radius: 4px;
  font-size: 11px; letter-spacing: 0.1em;
  pointer-events: none;
  font-family: 'Inter', sans-serif;
}
.np-editor-controls {
  width: 280px;
  display: flex; flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: rgba(0,0,0,0.4);
  border-radius: 12px;
  border: 1px solid rgba(212,175,55,0.15);
  font-family: 'Inter', sans-serif;
}
.np-editor-controls .control-group {
  display: flex; flex-direction: column; gap: 8px;
}
.np-editor-controls label {
  font-size: 11px; color: rgba(245,239,224,0.6);
  letter-spacing: 0.2em; text-transform: uppercase;
  display: flex; justify-content: space-between;
}
.np-editor-controls label .value {
  color: #D4AF37; font-variant-numeric: tabular-nums;
}
.np-editor-controls input[type="range"] {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(212,175,55,0.2);
  border-radius: 2px;
  outline: none;
}
.np-editor-controls input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #D4AF37;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(212,175,55,0.6);
}
.np-editor-controls input[type="range"]::-moz-range-thumb {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #D4AF37;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 8px rgba(212,175,55,0.6);
}
.np-editor-controls .reset-btn {
  padding: 8px 14px;
  background: transparent;
  border: 1px solid rgba(212,175,55,0.3);
  color: rgba(245,239,224,0.7);
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px; letter-spacing: 0.2em;
  text-transform: uppercase;
  font-family: 'Inter', sans-serif;
  transition: all 0.2s;
}
.np-editor-controls .reset-btn:hover {
  background: rgba(212,175,55,0.1);
  border-color: #D4AF37; color: #D4AF37;
}
.np-editor-controls .save-btn {
  padding: 12px 20px;
  background: linear-gradient(180deg, #D4AF37 0%, #A8862A 100%);
  color: #0a0707;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px; letter-spacing: 0.2em;
  text-transform: uppercase;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  transition: all 0.2s;
  margin-top: auto;
}
.np-editor-controls .save-btn:hover {
  box-shadow: 0 0 20px rgba(212,175,55,0.5);
  transform: translateY(-1px);
}
.np-editor-controls .save-btn:disabled {
  opacity: 0.4; cursor: not-allowed;
  transform: none;
}
.np-modal .actions {
  display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;
}
.np-modal .btn {
  padding: 10px 20px; border-radius: 6px;
  font-family: 'Inter', sans-serif; font-size: 13px;
  cursor: pointer; transition: all 0.2s;
  border: 1px solid rgba(212, 175, 55, 0.4);
  background: transparent; color: #F5EFE0;
  letter-spacing: 0.1em; text-transform: uppercase;
}
.np-modal .btn:hover {
  background: rgba(212, 175, 55, 0.1);
  border-color: #D4AF37;
}
.np-modal .btn.primary {
  background: linear-gradient(180deg, #D4AF37 0%, #A8862A 100%);
  color: #0a0707; border-color: #D4AF37; font-weight: 500;
}
.np-modal .btn.primary:hover {
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
}
.np-modal .btn:disabled {
  opacity: 0.4; cursor: not-allowed;
}
.np-toast {
  position: fixed; bottom: 30px; left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: rgba(0,0,0,0.9);
  border: 1px solid #D4AF37;
  color: #F5EFE0; padding: 12px 24px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif; font-size: 13px;
  z-index: 300; opacity: 0;
  transition: all 0.3s; pointer-events: none;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.np-toast.visible {
  opacity: 1; transform: translateX(-50%) translateY(0);
}
.np-toast.error { border-color: #ff6666; color: #ffaaaa; }
.np-toast.success { border-color: #D4AF37; }

/* === HUD === */
.np-hud {
  position: fixed; bottom: 20px; left: 20px; z-index: 100;
  font-family: 'Inter', sans-serif; font-size: 11px;
  color: rgba(245,239,224,0.7);
  background: rgba(0, 0, 0, 0.75);
  padding: 14px 18px; border-radius: 10px;
  border: 1px solid rgba(212, 175, 55, 0.25);
  opacity: 0; transition: opacity 0.3s;
  pointer-events: none;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.np-hud.np-visible { opacity: 1; pointer-events: auto; }
.np-hud h4 {
  color: #D4AF37; font-size: 10px; letter-spacing: 0.35em;
  text-transform: uppercase; margin: 0 0 10px 0; font-weight: 500;
}
.np-hud kbd {
  display: inline-block; padding: 2px 7px;
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 3px; font-family: 'SF Mono', Monaco, monospace;
  font-size: 10px; color: #F5EFE0; margin-right: 6px;
}
.np-hud .row { margin: 5px 0; }
.np-hud .scene-info {
  margin-top: 12px; padding-top: 12px;
  border-top: 1px solid rgba(212, 175, 55, 0.15);
  font-size: 12px; color: #F5EFE0;
}
.np-hud .scene-info .label {
  color: rgba(245,239,224,0.5); margin-right: 8px;
}

.np-progress-bar {
  position: fixed; top: 0; left: 0; height: 2px;
  background: linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.4) 20%, #D4AF37 50%, rgba(212,175,55,0.4) 80%, transparent 100%);
  z-index: 99; width: 0%; opacity: 0;
  transition: opacity 0.3s; box-shadow: 0 0 8px rgba(212,175,55,0.5);
}
.np-progress-bar.np-visible { opacity: 0.9; }

/* === Keyframes === */
@keyframes npLogoAppear {
  0% { opacity: 0; transform: scale(0.82) translateY(30px) rotateX(15deg); filter: blur(20px) drop-shadow(0 0 0 rgba(212, 175, 55, 0)); }
  40% { opacity: 0.4; filter: blur(8px) drop-shadow(0 0 20px rgba(212, 175, 55, 0.2)); }
  75% { opacity: 0.9; transform: scale(1.03) translateY(-5px) rotateX(-3deg); filter: blur(0) drop-shadow(0 0 30px rgba(212, 175, 55, 0.3)); }
  100% { opacity: 1; transform: scale(1) translateY(0) rotateX(0); filter: blur(0) drop-shadow(0 0 30px rgba(212, 175, 55, 0.35)); }
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

/* Ken Burns sutil - zoom mínimo, fondo visible */
@keyframes npKenBurnsA {
  0% { transform: scale(1.00) translate(0, 0); filter: brightness(0.75); }
  30% { filter: brightness(0.88); }
  100% { transform: scale(1.06) translate(0, 1%); filter: brightness(0.95); }
}
@keyframes npKenBurnsB {
  0% { transform: scale(1.06) translate(0, 1%); filter: brightness(0.95); }
  70% { filter: brightness(0.88); }
  100% { transform: scale(1.00) translate(0, 0); filter: brightness(0.75); }
}
@keyframes npKenBurnsC {
  0% { transform: scale(1.02) translate(0, 1%); filter: brightness(0.78); }
  50% { filter: brightness(0.90); }
  100% { transform: scale(1.06) translate(0, 2%); filter: brightness(0.95); }
}
@keyframes npKenBurnsD {
  0% { transform: scale(1.00) translate(0.5%, 0); filter: brightness(0.75); }
  100% { transform: scale(1.05) translate(-0.5%, 1%); filter: brightness(0.95); }
}
@keyframes npKenBurnsE {
  0% { transform: scale(1.05) translate(-0.5%, 1%); filter: brightness(0.95); }
  100% { transform: scale(1.00) translate(0.5%, 0); filter: brightness(0.75); }
}

@keyframes npCaptionRise {
  0% { opacity: 0; transform: translate(-50%, 40px); filter: blur(12px); letter-spacing: 0.6em; }
  60% { opacity: 0.9; filter: blur(2px); letter-spacing: 0.5em; }
  100% { opacity: 1; transform: translate(-50%, 0); filter: blur(0); letter-spacing: 0.45em; }
}

@keyframes npFinalLogoIn {
  0% { opacity: 0; transform: scale(0.88) translateY(30px) rotateY(10deg); filter: blur(15px); }
  60% { opacity: 0.85; filter: blur(3px); }
  100% { opacity: 1; transform: scale(1) translateY(0) rotateY(0); filter: blur(0); }
}
@keyframes npPhraseIn {
  0% { opacity: 0; transform: translateY(40px); filter: blur(8px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}

@keyframes npBreathe {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 40px rgba(212,175,55,0.4)); }
  50% { transform: scale(1.02); filter: drop-shadow(0 0 60px rgba(212,175,55,0.6)); }
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
  const videoElementsRef = useRef<Record<string, HTMLVideoElement | null>>({})
  const [hudVisible, setHudVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeSceneInfo, setActiveSceneInfo] = useState<{id: string, type: string} | null>(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({})
  const [modalVisible, setModalVisible] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar galería al montar
  const loadGallery = useCallback(async () => {
    const data = await fetchGallery()
    if (data.success) {
      setGalleryItems(data.items)
      console.log(`Galería cargada: ${data.count} archivos (${data.images} imágenes, ${data.videos} videos)`)
    }
  }, [])

  useEffect(() => {
    loadGallery()
  }, [loadGallery])

  // Callback cuando un video termina antes que su escena
  const handleVideoEndsEarly = useCallback((sceneId: string) => {
    // El video terminó - saltar a la siguiente escena
    console.log(`Video ${sceneId} terminó, saltando a siguiente escena`)
    // Usamos setTimeout para evitar race conditions
    setTimeout(() => {
      // Llamar a skipToNextScene desde el window.__anim si está disponible
      if ((window as any).__anim?.skipToNextScene) {
        (window as any).__anim.skipToNextScene()
      }
    }, 100)
  }, [])

  const {
    scenes, totalDuration, currentTime, currentSceneIndex,
    isPlaying, setIsPlaying, getOpacities, jumpToScene, seekTo,
    skipToNextScene, onSceneChangeRef, loopCount
  } = useTimeline(galleryItems, videoDurations, handleVideoEndsEarly)

  useParticles(particlesContainerRef)

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Exponer estado globalmente
  useEffect(() => {
    ;(window as any).__anim = {
      timeline: {
        currentTime, totalDuration, currentSceneIndex, isPlaying, scenes,
        seekTo, jumpToScene, skipToNextScene, loopCount,
        play: () => setIsPlaying(true),
        pause: () => setIsPlaying(false)
      },
      gallery: galleryItems,
      videoDurations,
      reloadGallery: loadGallery
    }
  }, [currentTime, totalDuration, currentSceneIndex, isPlaying, scenes, seekTo, jumpToScene, skipToNextScene, loopCount, galleryItems, videoDurations, loadGallery])

  // Cursor personalizado - siempre activo
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY })
    }
    const handleMouseDown = () => {
      const dot = document.querySelector('.np-cursor-dot') as HTMLElement
      const ring = document.querySelector('.np-cursor-ring') as HTMLElement
      if (dot) dot.style.transform = 'translate(-50%, -50%) scale(0.7)'
      if (ring) ring.style.transform = 'translate(-50%, -50%) scale(0.85)'
    }
    const handleMouseUp = () => {
      const dot = document.querySelector('.np-cursor-dot') as HTMLElement
      const ring = document.querySelector('.np-cursor-ring') as HTMLElement
      if (dot) dot.style.transform = 'translate(-50%, -50%) scale(1)'
      if (ring) ring.style.transform = 'translate(-50%, -50%) scale(1)'
    }
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('button, a, .np-upload-btn, .np-dropzone, .np-file-item, [role="button"]')) {
        setIsHovering(true)
      } else {
        setIsHovering(false)
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseover', handleMouseOver)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseover', handleMouseOver)
    }
  }, [])

  // Callback de cambio de escena
  onSceneChangeRef.current = (scene: Scene, index: number) => {
    setActiveSceneInfo({ id: scene.id, type: scene.type })
    const el = sceneElementsRef.current[scene.id]
    if (!el) return

    if (scene.type === 'photo' || scene.type === 'video') {
      // Para video: reproducir SIN SONIDO hasta el final
      if (scene.type === 'video') {
        const video = videoElementsRef.current[scene.id]
        if (video) {
          // Silenciar el video
          video.muted = true
          video.volume = 0
          // Reiniciar desde el inicio
          try { video.currentTime = 0 } catch {}
          video.play().catch(() => {})

          // Medir duración real del video y guardarla
          const measureDuration = () => {
            if (video.duration && isFinite(video.duration) && video.duration > 0) {
              const filename = scene.mediaItem?.filename
              if (filename) {
                setVideoDurations(prev => {
                  if (prev[filename] === video.duration) return prev
                  return { ...prev, [filename]: video.duration }
                })
              }
            }
          }
          if (video.readyState >= 1) {
            measureDuration()
          } else {
            video.addEventListener('loadedmetadata', measureDuration, { once: true })
          }

          // Cuando el video termine, saltar a la siguiente escena
          const handleEnded = () => {
            console.log(`Video ${scene.id} ended`)
            handleVideoEndsEarly(scene.id)
            video.removeEventListener('ended', handleEnded)
          }
          video.addEventListener('ended', handleEnded)
        }
      }

      // Para foto: aplicar Ken Burns
      if (scene.type === 'photo') {
        const img = el.querySelector('.np-media-img') as HTMLImageElement
        const variations = ['npKenBurnsA', 'npKenBurnsB', 'npKenBurnsC', 'npKenBurnsD', 'npKenBurnsE']
        if (img) {
          img.style.animation = 'none'
          void img.offsetHeight
          img.style.animation = `${variations[(scene.mediaIndex || 0) % variations.length]} 8s ease-out forwards`
        }
      }

      const caption = el.querySelector('.np-media-caption') as HTMLElement
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

      // Pausar videos de escenas inactivas y reiniciar para próxima vez
      if (scene.type === 'video') {
        const video = videoElementsRef.current[scene.id]
        if (video) {
          if (opacity > 0.1) {
            // Solo reproducir si está pausado y no ha terminado
            if (video.paused && video.currentTime < video.duration) {
              video.play().catch(() => {})
            }
          } else {
            // Escena inactiva: pausar y reiniciar
            if (!video.paused) {
              video.pause()
              try { video.currentTime = 0 } catch {}
            }
          }
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
        case 'u': case 'U': setModalVisible(v => !v); break
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

  // Manejar upload - con progreso y chunked para archivos grandes
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFileName, setUploadFileName] = useState('')

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadProgress(0)
    setUploadFileName(files.length === 1 ? files[0].name : `${files.length} archivos`)
    try {
      const result = await uploadFilesSmart(Array.from(files), (percent, fileName) => {
        setUploadProgress(percent)
        setUploadFileName(fileName)
      })
      if (result.success) {
        const successCount = result.uploaded?.length || 0
        const errorCount = result.errors?.length || 0
        if (errorCount > 0) {
          showToast(`✓ ${successCount} subidos, ✗ ${errorCount} con error`, 'info')
        } else {
          showToast(`✓ ${successCount} archivo(s) subido(s) correctamente`, 'success')
        }
        await loadGallery()
      } else {
        // Mensaje de error detallado
        const errMsg = result.message || 'Error desconocido'
        if (errMsg.includes('Timeout') || errMsg.includes('tardó')) {
          showToast('Timeout: el archivo es muy grande o la conexión es lenta. Intenta de nuevo.', 'error')
        } else if (errMsg.includes('red') || errMsg.includes('network')) {
          showToast('Error de red. Verifica tu conexión a internet.', 'error')
        } else if (errMsg.includes('chunk')) {
          showToast(`Error en subida por partes: ${errMsg}`, 'error')
        } else if (errMsg.includes('HTTP 413')) {
          showToast('Archivo demasiado grande para el servidor', 'error')
        } else {
          showToast(`Error: ${errMsg}`, 'error')
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido'
      showToast(`Error al subir: ${errMsg}`, 'error')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setUploadFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [loadGallery, showToast])

  // Drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.classList.remove('dragover')
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.classList.add('dragover')
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.classList.remove('dragover')
  }, [])

  // Eliminar archivo
  const handleDelete = useCallback(async (filename: string) => {
    if (!confirm(`¿Eliminar "${filename}"?`)) return
    const result = await deleteFile(filename)
    if (result.success) {
      showToast(`Eliminado: ${filename}`, 'success')
      await loadGallery()
    } else {
      showToast(`Error: ${result.message}`, 'error')
    }
  }, [loadGallery, showToast])

  // === Editor de imagen ===
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null)
  const [editorSettings, setEditorSettings] = useState<ImageSettings>({ pan_x: 0, pan_y: 0, zoom: 1 })
  const [editorDragging, setEditorDragging] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const editorDragStartRef = useRef<{ x: number; y: number; pan_x: number; pan_y: number } | null>(null)
  const editorCanvasRef = useRef<HTMLDivElement>(null)

  // Abrir editor
  const openEditor = useCallback((item: GalleryItem) => {
    setEditingItem(item)
    setEditorSettings(item.image_settings || { pan_x: 0, pan_y: 0, zoom: 1 })
  }, [])

  // Cerrar editor
  const closeEditor = useCallback(() => {
    setEditingItem(null)
    setEditorDragging(false)
    editorDragStartRef.current = null
  }, [])

  // Drag para pan
  const handleEditorMouseDown = useCallback((e: React.MouseEvent) => {
    setEditorDragging(true)
    editorDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pan_x: editorSettings.pan_x,
      pan_y: editorSettings.pan_y
    }
  }, [editorSettings])

  const handleEditorMouseMove = useCallback((e: React.MouseEvent) => {
    if (!editorDragging || !editorDragStartRef.current) return
    const canvas = editorCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    // Calcular delta en porcentaje del canvas
    const dx = ((e.clientX - editorDragStartRef.current.x) / rect.width) * 100
    const dy = ((e.clientY - editorDragStartRef.current.y) / rect.height) * 100
    // Aplicar inverso al pan (arrastrar derecha = imagen se mueve derecha)
    // Pero en la pantalla final, el pan_x positivo mueve la imagen a la derecha
    // así que aquí arrastrar derecha debería aumentar pan_x
    const newPanX = Math.max(-100, Math.min(100, editorDragStartRef.current.pan_x + dx))
    const newPanY = Math.max(-100, Math.min(100, editorDragStartRef.current.pan_y + dy))
    setEditorSettings(prev => ({ ...prev, pan_x: newPanX, pan_y: newPanY }))
  }, [editorDragging])

  const handleEditorMouseUp = useCallback(() => {
    setEditorDragging(false)
    editorDragStartRef.current = null
  }, [])

  // Wheel para zoom
  const handleEditorWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.001
    setEditorSettings(prev => ({
      ...prev,
      zoom: Math.max(1, Math.min(3, prev.zoom + delta))
    }))
  }, [])

  // Reset
  const resetEditor = useCallback(() => {
    setEditorSettings({ pan_x: 0, pan_y: 0, zoom: 1 })
  }, [])

  // Guardar
  const saveEditorSettings = useCallback(async () => {
    if (!editingItem) return
    setEditorSaving(true)
    const result = await updateImageSettings(editingItem.filename, editorSettings)
    if (result.success) {
      showToast('✓ Ajustes guardados', 'success')
      // Actualizar la galería localmente
      setGalleryItems(prev => prev.map(item =>
        item.filename === editingItem.filename
          ? { ...item, image_settings: editorSettings }
          : item
      ))
      closeEditor()
    } else {
      showToast(`Error: ${result.message}`, 'error')
    }
    setEditorSaving(false)
  }, [editingItem, editorSettings, showToast, closeEditor])

  // Stats de la galería
  const imageCount = galleryItems.filter(i => i.type === 'image').length
  const videoCount = galleryItems.filter(i => i.type === 'video').length

  return (
    <div className="np-stage">
      {/* Capas decorativas */}
      <div className="np-aurora"></div>
      <div className="np-particles" ref={particlesContainerRef}></div>
      <div className="np-grain"></div>
      <div className="np-vignette"></div>

      {/* Botón de Upload */}
      <button
        className={`np-upload-btn ${uploading ? 'uploading' : ''}`}
        onClick={() => setModalVisible(true)}
        title="Subir fotos y videos"
        aria-label="Subir archivos"
      >
        +
      </button>

      {/* Input oculto para archivos */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e.target.files)}
      />

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

      {/* Escenas dinámicas (fotos y videos) - renderizadas desde scenes para soportar shuffle */}
      {scenes.filter(s => s.type === 'photo' || s.type === 'video').map((scene) => {
        const item = scene.mediaItem
        if (!item) return null
        const isVideo = scene.type === 'video'
        const sceneId = scene.id
        return (
          <div
            key={sceneId}
            className="np-scene np-media-scene"
            id={sceneId}
            ref={el => { sceneElementsRef.current[sceneId] = el }}
          >
            <div className="np-media-frame">
              {/* Capa de fondo borroso (solo cuando zoom < 1.0 para fotos) */}
              {item.image_settings && !isVideo && item.image_settings.zoom < 1.0 && (
                <div
                  className="np-media-bg-blur"
                  style={{
                    backgroundImage: `url(${item.path})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(40px) brightness(0.5) saturate(1.2)',
                    transform: 'scale(1.15)',
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 0
                  }}
                />
              )}
              <div
                className="np-media-img-wrapper"
                style={item.image_settings ? {
                  // Aplicar zoom del usuario al wrapper (la imagen/video conserva Ken Burns)
                  transform: `scale(${item.image_settings.zoom})`,
                  transformOrigin: `${50 + item.image_settings.pan_x / 2}% ${30 + item.image_settings.pan_y / 2}%`,
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 1
                } : { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
              >
                {isVideo ? (
                  <video
                    ref={el => { videoElementsRef.current[sceneId] = el }}
                    className="np-media-video"
                    src={item.path}
                    muted
                    playsInline
                    preload="auto"
                    style={item.image_settings ? {
                      objectPosition: `${50 + item.image_settings.pan_x / 2}% ${30 + item.image_settings.pan_y / 2}%`
                    } : undefined}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="np-media-img"
                    src={item.path}
                    alt={item.caption || 'Foto'}
                    style={item.image_settings ? {
                      objectPosition: `${50 + item.image_settings.pan_x / 2}% ${30 + item.image_settings.pan_y / 2}%`
                    } : undefined}
                  />
                )}
              </div>
              <div className="np-media-overlay"></div>
            </div>
            <div className="np-media-border">
              <div className="corner-tr"></div>
              <div className="corner-bl"></div>
            </div>
            {item.caption && (
              <div className="np-media-caption">
                <span className="divider"></span>
                <span className="text">{item.caption}</span>
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

      {/* Cursor personalizado elegante - siempre visible */}
      <div
        className="np-cursor-dot"
        style={{ left: cursorPos.x, top: cursorPos.y }}
      ></div>
      <div
        className={`np-cursor-ring ${isHovering ? 'np-hover' : ''}`}
        style={{ left: cursorPos.x, top: cursorPos.y }}
      ></div>

      {/* HUD */}
      <div className={`np-hud ${hudVisible ? 'np-visible' : ''}`}>
        <h4>Controles</h4>
        <div className="row"><kbd>Space</kbd> {isPlaying ? 'Pausa' : 'Play'}</div>
        <div className="row"><kbd>←</kbd> <kbd>→</kbd> Escena anterior / siguiente</div>
        <div className="row"><kbd>1</kbd>-<kbd>9</kbd> Saltar a escena</div>
        <div className="row"><kbd>U</kbd> Subir archivos</div>
        <div className="row"><kbd>R</kbd> Reiniciar</div>
        <div className="row"><kbd>F</kbd> Pantalla completa</div>
        <div className="row"><kbd>?</kbd> Ocultar este panel</div>
        <div className="scene-info">
          <div><span className="label">Tiempo:</span> {currentTime.toFixed(2)}s / {totalDuration.toFixed(2)}s</div>
          <div><span className="label">Escena:</span> {activeSceneInfo?.id || '-'} ({activeSceneInfo?.type || '-'})</div>
          <div><span className="label">Loop:</span> #{loopCount + 1} (orden aleatorio)</div>
          <div><span className="label">Galería:</span> {imageCount} fotos + {videoCount} videos</div>
          <div><span className="label">Progreso:</span> {progress.toFixed(1)}%</div>
        </div>
      </div>

      {/* Modal de gestión de archivos */}
      <div
        className={`np-modal-backdrop ${modalVisible ? 'np-visible' : ''}`}
        onClick={() => setModalVisible(false)}
      >
        <div className="np-modal" onClick={e => e.stopPropagation()}>
          <h2>Galería de la Animación</h2>
          <div className="subtitle">
            Sube tus fotos y videos — se integrarán automáticamente en la animación
          </div>

          <div className="stats">
            <div className="stat">
              <div className="num">{galleryItems.length}</div>
              <div className="label">Total</div>
            </div>
            <div className="stat">
              <div className="num">{imageCount}</div>
              <div className="label">Fotos</div>
            </div>
            <div className="stat">
              <div className="num">{videoCount}</div>
              <div className="label">Videos</div>
            </div>
          </div>

          <div
            className="np-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="icon">+</div>
            <div className="text">
              {uploading ? 'Subiendo...' : 'Click o arrastra archivos aquí'}
            </div>
            <div className="hint">
              Fotos: JPG, PNG, WebP, GIF · Videos: MP4, WebM, MOV · Máx 100MB
            </div>
          </div>

          {galleryItems.length > 0 && (
            <div className="np-file-list">
              {galleryItems.map((item, i) => (
                <div key={item.filename} className="np-file-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {item.type === 'image' ? (
                    <img className="thumb" src={item.path} alt={item.filename} />
                  ) : (
                    <div className="thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: 20 }}>▶</div>
                  )}
                  <div className="info">
                    <div className="name">{item.caption || item.filename}</div>
                    <div className="meta">
                      {(item.size / 1024).toFixed(0)} KB · {item.filename}
                      {item.image_settings && (
                        <span style={{ color: '#D4AF37', marginLeft: 8 }}>
                          · ajustada
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`badge ${item.type}`}>{item.type === 'image' ? 'Foto' : 'Video'}</span>
                  <button
                    className="edit-btn"
                    onClick={() => openEditor(item)}
                    title="Ajustar imagen (pan y zoom)"
                  >
                    Editar
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(item.filename)}
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="actions">
            <button className="btn" onClick={() => setModalVisible(false)}>
              Cerrar
            </button>
            <button
              className="btn primary"
              onClick={() => {
                loadGallery()
                setModalVisible(false)
                showToast('Animación recargada', 'success')
              }}
            >
              Recargar animación
            </button>
          </div>
        </div>
      </div>

      {/* Barra de progreso de upload */}
      {uploading && (
        <div className="np-upload-progress">
          <div className="label">
            <span>Subiendo: {uploadFileName}</span>
            <span className="percent">{uploadProgress.toFixed(0)}%</span>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`np-toast visible ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Editor de imagen */}
      {editingItem && (
        <div
          className="np-editor-overlay np-visible"
          onMouseUp={handleEditorMouseUp}
          onMouseLeave={handleEditorMouseUp}
        >
          <div className="np-editor">
            <div className="np-editor-header">
              <h2>Ajustar {editingItem.type === 'video' ? 'video' : 'imagen'}</h2>
              <button
                className="close-btn"
                onClick={closeEditor}
                title="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="np-editor-body">
              <div
                className="np-editor-canvas"
                ref={editorCanvasRef}
                onMouseDown={handleEditorMouseDown}
                onMouseMove={handleEditorMouseMove}
                onWheel={handleEditorWheel}
              >
                {/* Capa de fondo borroso cuando zoom < 1.0 */}
                {editorSettings.zoom < 1.0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      backgroundImage: `url(${editingItem.path})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(40px) brightness(0.5) saturate(1.2)',
                      transform: 'scale(1.15)'
                    }}
                  />
                )}
                {/* Preview de la imagen o video */}
                {editingItem.type === 'video' ? (
                  <video
                    src={editingItem.path}
                    muted
                    loop
                    autoPlay
                    playsInline
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: `${editorSettings.zoom * 100}%`,
                      height: 'auto',
                      objectFit: 'cover',
                      objectPosition: `${50 + editorSettings.pan_x / 2}% ${30 + editorSettings.pan_y / 2}%`,
                      position: 'relative',
                      zIndex: 1,
                      pointerEvents: 'none',
                      transform: 'none'
                    }}
                  />
                ) : (
                  <img
                    src={editingItem.path}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: `${editorSettings.zoom * 100}%`,
                      height: 'auto',
                      objectFit: 'cover',
                      objectPosition: `${50 + editorSettings.pan_x / 2}% ${30 + editorSettings.pan_y / 2}%`,
                      position: 'relative',
                      zIndex: 1,
                      pointerEvents: 'none',
                      transform: 'none'
                    }}
                  />
                )}
                <div className="hint" style={{ zIndex: 2 }}>Arrastra para mover · Rueda para zoom</div>
              </div>
              <div className="np-editor-controls">
                <div className="control-group">
                  <label>
                    <span>Posición X</span>
                    <span className="value">{editorSettings.pan_x.toFixed(0)}</span>
                  </label>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={editorSettings.pan_x}
                    onChange={(e) => setEditorSettings(prev => ({ ...prev, pan_x: Number(e.target.value) }))}
                  />
                </div>
                <div className="control-group">
                  <label>
                    <span>Posición Y</span>
                    <span className="value">{editorSettings.pan_y.toFixed(0)}</span>
                  </label>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={editorSettings.pan_y}
                    onChange={(e) => setEditorSettings(prev => ({ ...prev, pan_y: Number(e.target.value) }))}
                  />
                </div>
                <div className="control-group">
                  <label>
                    <span>Zoom</span>
                    <span className="value">{editorSettings.zoom.toFixed(2)}x</span>
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.01}
                    value={editorSettings.zoom}
                    onChange={(e) => setEditorSettings(prev => ({ ...prev, zoom: Number(e.target.value) }))}
                  />
                </div>
                <button className="reset-btn" onClick={resetEditor}>
                  Restablecer
                </button>
                <button
                  className="save-btn"
                  onClick={saveEditorSettings}
                  disabled={editorSaving}
                >
                  {editorSaving ? 'Guardando...' : 'Guardar ajustes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
