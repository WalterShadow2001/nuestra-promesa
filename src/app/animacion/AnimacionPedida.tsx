'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CONFIG } from './config'
import {
  fetchPhotos,
  uploadPhotos,
  adminLogin,
  verifyAdminToken,
  deletePhoto,
  type PhotoItem
} from './photos'

// ============================================================
// Curvas de easing
// ============================================================
const Easing = {
  inOutQuart: (t: number) => t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t + 2, 4) / 2,
  inOutQuint: (t: number) => t < 0.5 ? 16*t*t*t*t*t : 1 - Math.pow(-2*t + 2, 5) / 2,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
}

// ============================================================
// Tipos
// ============================================================
type AppMode = 'home' | 'slideshow' | 'admin'

interface Particle {
  x: number; y: number; vy: number; amp: number; freq: number; phase: number
  baseOpacity: number; opacityAmp: number; opacityFreq: number; opacityPhase: number
  depth: number; size: number; twinkle: number; twinkleFreq: number
}

// ============================================================
// CSS principal - tema blanco + dorado
// ============================================================
const ANIMATION_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=Inter:wght@200;300;400;500&display=swap');

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html, body {
  margin: 0; padding: 0; overflow: hidden;
  background: #FAFAF7;
  font-family: 'Cormorant Garamond', serif;
  color: #2A2620;
  cursor: none;
}

/* === Cursor elegante === */
.np-cursor-dot {
  position: fixed; width: 8px; height: 8px; border-radius: 50%;
  background: #B8945F; pointer-events: none; z-index: 9999;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 6px #B8945F, 0 0 12px rgba(184,148,95,0.5);
  transition: width 0.2s, height 0.2s;
}
.np-cursor-ring {
  position: fixed; width: 32px; height: 32px;
  border: 1px solid rgba(184,148,95,0.5); border-radius: 50%;
  pointer-events: none; z-index: 9998;
  transform: translate(-50%, -50%);
  transition: transform 0.15s ease-out, width 0.2s, height 0.2s, border-color 0.2s;
}
.np-cursor-ring.np-hover {
  width: 48px; height: 48px; border-color: #B8945F;
  background: rgba(184,148,95,0.08);
}
@media (hover: none) {
  .np-cursor-dot, .np-cursor-ring { display: none; }
  html, body { cursor: auto; }
}

/* === Stage principal === */
.np-stage {
  position: fixed; inset: 0;
  background: radial-gradient(ellipse at 50% 30%, #FFFEF9 0%, #FAFAF7 50%, #F0EBE0 100%);
  overflow: hidden;
}

/* === Capas decorativas === */
.np-particles { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.np-particle {
  position: absolute; border-radius: 50%;
  background: #B8945F;
  box-shadow: 0 0 4px #B8945F, 0 0 8px rgba(184,148,95,0.4);
  pointer-events: none; will-change: transform, opacity;
}

.np-vignette {
  position: absolute; inset: 0; pointer-events: none; z-index: 50;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(184,148,95,0.08) 90%, rgba(0,0,0,0.05) 100%);
}

/* === Home Screen (invitados) === */
.np-home {
  position: relative; z-index: 10;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 100vh; padding: 40px 20px;
}
.np-home-logo {
  position: relative; width: min(280px, 50vw); height: auto;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 40px;
}
.np-home-logo-ring {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 280px; height: 280px;
  border: 1px solid rgba(184,148,95,0.4);
  border-radius: 50%;
  pointer-events: none;
}
.np-home-logo-ring-2 {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 240px; height: 240px;
  border: 1px dashed rgba(184,148,95,0.2);
  border-radius: 50%;
  pointer-events: none;
  animation: npRingRotate 80s linear infinite;
}
@keyframes npRingRotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
.np-home-initials {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(80px, 12vw, 140px);
  font-weight: 300;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, #B8945F 0%, #8B6B3F 50%, #B8945F 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 30px rgba(184,148,95,0.2);
  position: relative; z-index: 1;
}
.np-home-name {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(28px, 3vw, 42px);
  font-weight: 300;
  letter-spacing: 0.3em;
  color: #2A2620;
  margin-top: 24px;
  text-align: center;
}
.np-home-date {
  font-family: 'Inter', sans-serif;
  font-size: clamp(12px, 1vw, 14px);
  font-weight: 300;
  letter-spacing: 0.4em;
  color: rgba(42,38,32,0.6);
  text-transform: uppercase;
  margin-top: 16px;
}
.np-home-ornament {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin: 32px 0 60px 0; opacity: 0.7;
}
.np-home-ornament .line {
  width: 60px; height: 1px;
  background: linear-gradient(90deg, transparent, #B8945F, transparent);
}
.np-home-ornament .diamond {
  width: 6px; height: 6px; background: #B8945F;
  transform: rotate(45deg);
  box-shadow: 0 0 8px #B8945F;
}

.np-home-buttons {
  display: flex; gap: 24px; flex-wrap: wrap; justify-content: center;
}
.np-btn {
  position: relative;
  padding: 18px 36px;
  background: transparent;
  border: 1px solid #B8945F;
  color: #2A2620;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(16px, 1.5vw, 20px);
  letter-spacing: 0.25em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.4s ease;
  overflow: hidden;
  min-width: 220px;
  font-weight: 400;
}
.np-btn::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(184,148,95,0.15), transparent);
  transition: left 0.6s ease;
}
.np-btn:hover::before { left: 100%; }
.np-btn:hover {
  background: rgba(184,148,95,0.08);
  border-color: #8B6B3F;
  box-shadow: 0 4px 20px rgba(184,148,95,0.15);
  transform: translateY(-2px);
}
.np-btn-primary {
  background: linear-gradient(135deg, #B8945F 0%, #8B6B3F 100%);
  color: #FAFAF7;
  border-color: transparent;
}
.np-btn-primary:hover {
  background: linear-gradient(135deg, #8B6B3F 0%, #B8945F 100%);
  box-shadow: 0 6px 25px rgba(184,148,95,0.4);
}

/* === Admin Lock (solo desktop) === */
.np-admin-lock {
  position: fixed;
  bottom: 20px; left: 20px;
  z-index: 100;
  width: 36px; height: 36px;
  background: transparent;
  border: none;
  color: rgba(184,148,95,0.3);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s;
  padding: 0;
}
.np-admin-lock:hover {
  color: #B8945F;
  transform: scale(1.1);
}
.np-admin-lock svg {
  width: 24px; height: 24px;
}
/* Solo visible en desktop (con hover) */
@media (hover: none), (max-width: 768px) {
  .np-admin-lock { display: none !important; }
}

/* === Upload Modal === */
.np-modal-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(250,250,247,0.95);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.np-modal-backdrop.np-visible { opacity: 1; pointer-events: auto; }
.np-modal {
  background: #FFFEF9;
  border: 1px solid rgba(184,148,95,0.3);
  border-radius: 16px;
  padding: 40px;
  max-width: 560px; width: 90vw;
  max-height: 90vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(42,38,32,0.15);
  font-family: 'Inter', sans-serif;
}
.np-modal h2 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 36px; font-weight: 400;
  background: linear-gradient(180deg, #B8945F 0%, #8B6B3F 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 8px 0; text-align: center;
  letter-spacing: 0.05em;
}
.np-modal .subtitle {
  color: rgba(42,38,32,0.6); font-size: 14px;
  text-align: center; margin-bottom: 32px;
  letter-spacing: 0.05em;
}
.np-dropzone {
  border: 2px dashed rgba(184,148,95,0.4);
  border-radius: 12px;
  padding: 50px 20px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
  background: rgba(184,148,95,0.03);
}
.np-dropzone:hover, .np-dropzone.dragover {
  border-color: #B8945F;
  background: rgba(184,148,95,0.1);
  transform: scale(1.01);
}
.np-dropzone .icon {
  font-size: 48px; color: #B8945F;
  margin-bottom: 12px; font-weight: 200;
}
.np-dropzone .text {
  color: #2A2620; font-size: 16px;
  margin-bottom: 4px;
}
.np-dropzone .hint {
  color: rgba(42,38,32,0.5); font-size: 12px;
}
.np-modal .actions {
  display: flex; gap: 12px; margin-top: 24px;
  justify-content: center;
}
.np-modal .btn {
  padding: 12px 24px;
  border: 1px solid rgba(184,148,95,0.4);
  background: transparent;
  color: #2A2620;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-size: 12px; letter-spacing: 0.2em;
  text-transform: uppercase;
  transition: all 0.2s;
}
.np-modal .btn:hover {
  background: rgba(184,148,95,0.1);
  border-color: #B8945F;
}

/* === Login admin === */
.np-login-input {
  width: 100%;
  padding: 16px 20px;
  background: rgba(184,148,95,0.05);
  border: 1px solid rgba(184,148,95,0.3);
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  color: #2A2620;
  text-align: center;
  letter-spacing: 0.3em;
  outline: none;
  transition: all 0.2s;
}
.np-login-input:focus {
  border-color: #B8945F;
  background: #FFFEF9;
  box-shadow: 0 0 0 3px rgba(184,148,95,0.1);
}

/* === Admin Panel === */
.np-admin-panel h3 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px; font-weight: 500;
  color: #2A2620;
  margin: 0 0 12px 0;
}
.np-admin-stats {
  display: flex; gap: 16px; margin-bottom: 20px;
  padding: 16px; background: rgba(184,148,95,0.05);
  border-radius: 8px;
  border: 1px solid rgba(184,148,95,0.15);
}
.np-admin-stat {
  flex: 1; text-align: center;
}
.np-admin-stat .num {
  font-family: 'Cormorant Garamond', serif;
  font-size: 32px; color: #B8945F; font-weight: 500;
}
.np-admin-stat .label {
  font-size: 10px; color: rgba(42,38,32,0.5);
  letter-spacing: 0.2em; text-transform: uppercase;
  margin-top: 4px;
}
.np-admin-file-list {
  max-height: 400px; overflow-y: auto;
  border: 1px solid rgba(184,148,95,0.15);
  border-radius: 8px;
}
.np-admin-file-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(184,148,95,0.08);
  transition: background 0.2s;
}
.np-admin-file-item:last-child { border-bottom: none; }
.np-admin-file-item:hover { background: rgba(184,148,95,0.05); }
.np-admin-file-item img.thumb {
  width: 50px; height: 50px; border-radius: 4px;
  object-fit: cover; background: rgba(184,148,95,0.1);
  border: 1px solid rgba(184,148,95,0.2);
}
.np-admin-file-item .info { flex: 1; min-width: 0; }
.np-admin-file-item .name {
  color: #2A2620; font-size: 13px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.np-admin-file-item .meta {
  color: rgba(42,38,32,0.5); font-size: 11px; margin-top: 2px;
}
.np-admin-file-item .delete-btn {
  background: transparent; border: 1px solid rgba(180,80,80,0.3);
  color: rgba(180,80,80,0.7); cursor: pointer;
  padding: 6px 12px; border-radius: 4px;
  font-size: 11px; transition: all 0.2s;
  font-family: 'Inter', sans-serif;
  text-transform: uppercase; letter-spacing: 0.1em;
}
.np-admin-file-item .delete-btn:hover {
  background: rgba(180,80,80,0.1);
  border-color: rgba(180,80,80,0.6);
  color: rgba(180,80,80,1);
}

/* === Toast === */
.np-toast {
  position: fixed; bottom: 30px; left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: #FFFEF9;
  border: 1px solid #B8945F;
  color: #2A2620;
  padding: 14px 28px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif; font-size: 13px;
  z-index: 300; opacity: 0;
  transition: all 0.3s; pointer-events: none;
  box-shadow: 0 8px 24px rgba(42,38,32,0.15);
  letter-spacing: 0.05em;
}
.np-toast.visible {
  opacity: 1; transform: translateX(-50%) translateY(0);
}
.np-toast.error { border-color: #C97A7A; color: #8B3838; }
.np-toast.success { border-color: #B8945F; }

/* === Upload progress === */
.np-upload-progress {
  position: fixed; bottom: 30px; left: 50%;
  transform: translateX(-50%);
  background: #FFFEF9;
  border: 1px solid #B8945F;
  padding: 16px 24px;
  border-radius: 12px;
  z-index: 250;
  min-width: 320px;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 10px 30px rgba(42,38,32,0.2);
}
.np-upload-progress .label {
  color: #2A2620; font-size: 13px;
  margin-bottom: 10px;
  display: flex; justify-content: space-between;
}
.np-upload-progress .label .percent { color: #B8945F; }
.np-upload-progress .bar {
  width: 100%; height: 4px;
  background: rgba(184,148,95,0.15);
  border-radius: 2px; overflow: hidden;
}
.np-upload-progress .bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #B8945F, #8B6B3F);
  transition: width 0.3s ease-out;
}

/* === Slideshow === */
.np-slideshow {
  position: fixed; inset: 0; z-index: 150;
  background: #FAFAF7;
}
.np-slideshow-exit {
  position: fixed; top: 24px; right: 24px; z-index: 200;
  width: 44px; height: 44px;
  background: rgba(250,250,247,0.8);
  border: 1px solid rgba(184,148,95,0.3);
  border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #B8945F; font-size: 24px; font-weight: 200;
  backdrop-filter: blur(8px);
  transition: all 0.2s;
}
.np-slideshow-exit:hover {
  background: rgba(184,148,95,0.1);
  border-color: #B8945F;
}

.np-slide {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none;
  will-change: opacity, transform;
}
.np-slide.np-active { opacity: 1; }
.np-slide-frame {
  position: absolute; inset: 0; overflow: hidden;
}
.np-slide-img, .np-slide-video {
  position: absolute; inset: -8%; width: 116%; height: 116%;
  object-fit: cover; will-change: transform;
  filter: brightness(0.95) contrast(1.05) saturate(0.95);
}
.np-slide-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom,
    rgba(42,38,32,0.2) 0%,
    rgba(42,38,32,0) 25%,
    rgba(42,38,32,0) 55%,
    rgba(42,38,32,0.5) 80%,
    rgba(42,38,32,0.85) 100%);
  pointer-events: none;
}
.np-slide-caption {
  position: absolute; bottom: 12vh; left: 50%;
  transform: translateX(-50%);
  text-align: center; z-index: 6;
  white-space: nowrap;
}
.np-slide-caption .divider {
  display: inline-block; width: 60px; height: 1px;
  background: linear-gradient(90deg, transparent, #B8945F, transparent);
  vertical-align: middle; margin: 0 24px;
}
.np-slide-caption .text {
  display: inline-block;
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(22px, 2.4vw, 42px);
  letter-spacing: 0.45em;
  color: #FAFAF7;
  text-transform: uppercase;
  vertical-align: middle;
  text-shadow: 0 0 20px rgba(0,0,0,0.6);
  margin-left: 0.45em;
  font-weight: 300;
}
.np-slide-final {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, #FFFEF9 0%, #FAFAF7 60%, #F0EBE0 100%);
  text-align: center;
}
.np-slide-final-logo {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(60px, 8vw, 100px);
  font-weight: 300;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #B8945F 0%, #8B6B3F 50%, #B8945F 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 24px;
}
.np-slide-final-phrase {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(28px, 3vw, 48px);
  font-style: italic;
  color: #2A2620;
  margin: 16px 0;
}
.np-slide-final-date {
  font-family: 'Inter', sans-serif;
  font-size: clamp(12px, 1vw, 14px);
  letter-spacing: 0.5em;
  color: rgba(42,38,32,0.6);
  text-transform: uppercase;
  margin-top: 24px;
}

/* === Slideshow Ken Burns === */
@keyframes npKenBurnsA {
  0% { transform: scale(1.00) translate(0, 0); }
  100% { transform: scale(1.06) translate(0, 1%); }
}
@keyframes npKenBurnsB {
  0% { transform: scale(1.06) translate(0, 1%); }
  100% { transform: scale(1.00) translate(0, 0); }
}
@keyframes npKenBurnsC {
  0% { transform: scale(1.02) translate(0, 1%); }
  100% { transform: scale(1.06) translate(0, 2%); }
}
@keyframes npKenBurnsD {
  0% { transform: scale(1.00) translate(0.5%, 0); }
  100% { transform: scale(1.05) translate(-0.5%, 1%); }
}
@keyframes npKenBurnsE {
  0% { transform: scale(1.05) translate(-0.5%, 1%); }
  100% { transform: scale(1.00) translate(0.5%, 0); }
}

@keyframes npCaptionRise {
  0% { opacity: 0; transform: translate(-50%, 30px); filter: blur(8px); }
  60% { opacity: 0.9; filter: blur(2px); }
  100% { opacity: 1; transform: translate(-50%, 0); filter: blur(0); }
}

@keyframes npFinalLogoIn {
  0% { opacity: 0; transform: scale(0.9); }
  60% { opacity: 0.85; }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes npPhraseIn {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}
`

// ============================================================
// Hook: partículas
// ============================================================
function useParticles(containerRef: React.RefObject<HTMLDivElement | null>) {
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const opts = CONFIG.style.particles
    const w = window.innerWidth, h = window.innerHeight
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
        vy: -(0.1 + Math.random() * 0.25) * opts.speed,
        amp: 20 + Math.random() * 60,
        freq: 0.0004 + Math.random() * 0.0008,
        phase: Math.random() * Math.PI * 2,
        baseOpacity: opts.minOpacity + Math.random() * (opts.maxOpacity - opts.minOpacity),
        opacityAmp: 0.1 + Math.random() * 0.25,
        opacityFreq: 0.0008 + Math.random() * 0.0016,
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
      const w = window.innerWidth, h = window.innerHeight

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i], el = elements[i]
        p.y += p.vy * dt * 0.06
        p.x += Math.sin(now * p.freq + p.phase) * 0.3 * p.depth
        if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; p.phase = Math.random() * Math.PI * 2 }
        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        const twinkle = 0.6 + Math.sin(now * p.twinkleFreq + p.twinkle) * 0.4
        const opacity = (p.baseOpacity + Math.sin(now * p.opacityFreq + p.opacityPhase) * p.opacityAmp) * twinkle
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.depth})`
        el.style.opacity = String(Math.max(0, Math.min(1, opacity)))
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

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ============================================================
// Componente: Home Screen
// ============================================================
function HomeScreen({ onSlideshow, onUpload }: {
  onSlideshow: () => void
  onUpload: () => void
}) {
  return (
    <div className="np-home">
      <div className="np-home-logo">
        <div className="np-home-logo-ring"></div>
        <div className="np-home-logo-ring-2"></div>
        <div className="np-home-initials">D&W</div>
      </div>
      <div className="np-home-name">D &amp; W</div>
      <div className="np-home-date">{CONFIG.couple.eventDate}</div>
      <div className="np-home-ornament">
        <div className="line"></div>
        <div className="diamond"></div>
        <div className="line"></div>
      </div>
      <div className="np-home-buttons">
        <button className="np-btn np-btn-primary" onClick={onUpload}>
          Subir fotos
        </button>
        <button className="np-btn" onClick={onSlideshow}>
          Ver slideshow
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Componente: Slideshow (fullscreen)
// ============================================================
function Slideshow({ photos, onExit }: {
  photos: PhotoItem[]
  onExit: () => void
}) {
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(true)
  const [loopCount, setLoopCount] = useState(0)
  const [shuffledPhotos, setShuffledPhotos] = useState<PhotoItem[]>([])
  const lastTimeRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const sceneElsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const videoElsRef = useRef<Record<string, HTMLVideoElement | null>>({})

  // Shuffle en cada loop
  useEffect(() => {
    if (photos.length === 0) return
    setShuffledPhotos(shuffle(photos))
  }, [photos, loopCount])

  // Build timeline
  const tl = CONFIG.timeline
  const scenes = useRef<{
    id: string
    type: 'photo' | 'video' | 'final'
    photo?: PhotoItem
    caption?: string
    start: number
    end: number
    transitionIn: number
    transitionOut: number
  }[]>([]).current

  useEffect(() => {
    scenes.length = 0
    let total = 0
    shuffledPhotos.forEach((p, i) => {
      const isVideo = p.type === 'video'
      const duration = isVideo ? 12 : tl.photoDuration
      scenes.push({
        id: `scene-${loopCount}-${i}`,
        type: isVideo ? 'video' : 'photo',
        photo: p,
        caption: p.caption,
        start: total,
        end: total + duration,
        transitionIn: tl.photoTransition,
        transitionOut: tl.photoTransition
      })
      total += duration
    })
    // Escena final (solo en loop 0)
    if (loopCount === 0) {
      scenes.push({
        id: 'scene-final',
        type: 'final',
        start: total,
        end: total + tl.finalScene,
        transitionIn: 1.5,
        transitionOut: 1.0
      })
      total += tl.finalScene + tl.loopPause
    } else {
      total += tl.loopPause
    }
  }, [shuffledPhotos, loopCount, tl.photoDuration, tl.photoTransition, tl.finalScene, tl.loopPause])

  const totalDuration = scenes.length > 0 ? scenes[scenes.length - 1].end + tl.loopPause : 0

  // RAF loop
  useEffect(() => {
    const loop = (time: number) => {
      let dt = time - lastTimeRef.current
      if (dt > 500) dt = 500
      if (dt < 0) dt = 0
      lastTimeRef.current = time
      if (isPlaying) {
        setCurrentTime(prev => {
          const next = prev + (dt / 1000)
          if (next >= totalDuration) {
            setLoopCount(c => c + 1)
            return 0
          }
          return next
        })
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying, totalDuration])

  // Reset al cambiar loop
  useEffect(() => {
    if (loopCount > 0) {
      setCurrentTime(0)
      setCurrentSceneIndex(-1)
    }
  }, [loopCount])

  // Detectar escena activa
  useEffect(() => {
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i]
      if (currentTime >= s.start && currentTime < s.end) {
        if (i !== currentSceneIndex) {
          setCurrentSceneIndex(i)
          // Trigger animaciones
          const el = sceneElsRef.current[s.id]
          if (el) {
            if (s.type === 'photo') {
              const img = el.querySelector('.np-slide-img') as HTMLImageElement
              const caption = el.querySelector('.np-slide-caption') as HTMLElement
              if (img) {
                img.style.animation = 'none'
                void img.offsetHeight
                const vars = ['npKenBurnsA', 'npKenBurnsB', 'npKenBurnsC', 'npKenBurnsD', 'npKenBurnsE']
                img.style.animation = `${vars[i % vars.length]} 8s ease-out forwards`
              }
              if (caption) {
                caption.style.animation = 'none'
                void caption.offsetHeight
                caption.style.animation = 'npCaptionRise 1.4s ease-out 0.6s forwards'
              }
            } else if (s.type === 'video') {
              const video = videoElsRef.current[s.id]
              if (video) {
                video.muted = true
                try { video.currentTime = 0 } catch {}
                video.play().catch(() => {})
              }
            } else if (s.type === 'final') {
              const logo = el.querySelector('.np-slide-final-logo') as HTMLElement
              const phrase = el.querySelector('.np-slide-final-phrase') as HTMLElement
              const date = el.querySelector('.np-slide-final-date') as HTMLElement
              if (logo) logo.style.animation = 'npFinalLogoIn 2s ease-out 0.3s forwards'
              if (phrase) phrase.style.animation = 'npPhraseIn 2s ease-out 1.5s forwards'
              if (date) date.style.animation = 'npPhraseIn 1.5s ease-out 2.5s forwards'
            }
          }
        }
        break
      }
    }
  }, [currentTime, currentSceneIndex, scenes])

  // Aplicar opacidades y pausar videos inactivos
  useEffect(() => {
    for (const scene of scenes) {
      const tIn = scene.transitionIn, tOut = scene.transitionOut
      let opacity = 0
      if (currentTime < scene.start) opacity = 0
      else if (currentTime >= scene.start && currentTime < scene.start + tIn) {
        opacity = Easing.inOutQuint((currentTime - scene.start) / tIn)
      } else if (currentTime >= scene.start + tIn && currentTime < scene.end - tOut) {
        opacity = 1
      } else if (currentTime >= scene.end - tOut && currentTime < scene.end) {
        opacity = 1 - Easing.inOutQuint((currentTime - (scene.end - tOut)) / tOut)
      }

      const el = sceneElsRef.current[scene.id]
      if (el) {
        el.style.opacity = opacity.toFixed(3)
        el.classList.toggle('np-active', opacity > 0.05)
      }
      if (scene.type === 'video') {
        const video = videoElsRef.current[scene.id]
        if (video) {
          if (opacity > 0.1) {
            if (video.paused && video.currentTime < video.duration) {
              video.play().catch(() => {})
            }
          } else {
            if (!video.paused) { video.pause(); try { video.currentTime = 0 } catch {} }
          }
        }
      }
    }
  }, [currentTime, scenes])

  // ESC para salir
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
      else if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onExit])

  // Fullscreen automático
  useEffect(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  if (photos.length === 0) {
    return (
      <div className="np-slideshow">
        <button className="np-slideshow-exit" onClick={onExit}>×</button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ textAlign: 'center', fontFamily: 'Cormorant Garamond, serif', color: '#2A2620' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>No hay fotos aún</div>
            <div style={{ fontSize: '14px', opacity: 0.6, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Sube fotos para ver el slideshow
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="np-slideshow">
      <button className="np-slideshow-exit" onClick={onExit} title="Salir (ESC)">×</button>
      {scenes.map((scene) => (
        <div
          key={scene.id}
          className="np-slide"
          ref={el => { sceneElsRef.current[scene.id] = el }}
        >
          {scene.type === 'photo' && (
            <>
              <div className="np-slide-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="np-slide-img" src={scene.photo!.path} alt={scene.caption || 'Foto'} />
                <div className="np-slide-overlay"></div>
              </div>
              {scene.caption && (
                <div className="np-slide-caption">
                  <span className="divider"></span>
                  <span className="text">{scene.caption}</span>
                  <span className="divider"></span>
                </div>
              )}
            </>
          )}
          {scene.type === 'video' && (
            <>
              <div className="np-slide-frame">
                <video
                  ref={el => { videoElsRef.current[scene.id] = el }}
                  className="np-slide-video"
                  src={scene.photo!.path}
                  muted
                  playsInline
                  preload="auto"
                />
                <div className="np-slide-overlay"></div>
              </div>
              {scene.caption && (
                <div className="np-slide-caption">
                  <span className="divider"></span>
                  <span className="text">{scene.caption}</span>
                  <span className="divider"></span>
                </div>
              )}
            </>
          )}
          {scene.type === 'final' && (
            <div className="np-slide-final">
              <div className="np-slide-final-logo">D &amp; W</div>
              <div className="np-slide-final-phrase">{CONFIG.phrases.final.phrase}</div>
              <div className="np-slide-final-date">{CONFIG.phrases.final.closing}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Componente: Upload Modal
// ============================================================
function UploadModal({ visible, onClose, onUploaded }: {
  visible: boolean
  onClose: () => void
  onUploaded: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragover, setDragover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = useShowToast()

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setProgress(0)
    try {
      const result = await uploadPhotos(Array.from(files), (percent) => {
        setProgress(percent)
      })
      if (result.success) {
        showToast(`✓ ${result.uploaded?.length || 0} foto(s) subida(s). ¡Gracias!`, 'success')
        onUploaded()
        onClose()
      } else {
        showToast(`Error: ${result.message}`, 'error')
      }
    } catch (err) {
      showToast('Error al subir fotos', 'error')
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [onClose, onUploaded, showToast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragover(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div
      className={`np-modal-backdrop ${visible ? 'np-visible' : ''}`}
      onClick={onClose}
    >
      <div className="np-modal" onClick={e => e.stopPropagation()}>
        <h2>Comparte tus fotos</h2>
        <div className="subtitle">
          Sube tus fotos y videos — aparecerán en el slideshow
        </div>

        <div
          className={`np-dropzone ${dragover ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragover(true) }}
          onDragLeave={() => setDragover(false)}
        >
          <div className="icon">+</div>
          <div className="text">
            {uploading ? `Subiendo... ${progress.toFixed(0)}%` : 'Click o arrastra fotos aquí'}
          </div>
          <div className="hint">
            Fotos: JPG, PNG, WebP · Videos: MP4, WebM, MOV · Máx 50MB
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="actions">
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>

        {uploading && (
          <div className="np-upload-progress">
            <div className="label">
              <span>Subiendo...</span>
              <span className="percent">{progress.toFixed(0)}%</span>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Componente: Admin Lock (esquina inf izq, solo desktop)
// ============================================================
function AdminLock({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  return (
    <button
      className="np-admin-lock"
      onClick={onOpenAdmin}
      title="Acceso administradores"
      aria-label="Admin"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="5" y="11" width="14" height="10" rx="1" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      </svg>
    </button>
  )
}

// ============================================================
// Componente: Admin Login Modal
// ============================================================
function AdminLoginModal({ visible, onClose, onSuccess }: {
  visible: boolean
  onClose: () => void
  onSuccess: (token: string) => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const showToast = useShowToast()

  const handleSubmit = useCallback(async () => {
    setLoading(true)
    const result = await adminLogin(password)
    if (result.success && result.token) {
      showToast('✓ Acceso concedido', 'success')
      setPassword('')
      onSuccess(result.token)
    } else {
      showToast('Contraseña incorrecta', 'error')
    }
    setLoading(false)
  }, [password, onSuccess, showToast])

  return (
    <div
      className={`np-modal-backdrop ${visible ? 'np-visible' : ''}`}
      onClick={onClose}
    >
      <div className="np-modal" onClick={e => e.stopPropagation()}>
        <h2>Acceso administradores</h2>
        <div className="subtitle">
          Ingresa la contraseña para gestionar las fotos
        </div>
        <input
          type="password"
          className="np-login-input"
          placeholder="• • • •"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          autoFocus
          disabled={loading}
        />
        <div className="actions">
          <button className="btn" onClick={onClose} disabled={loading}>Cancelar</button>
          <button
            className="btn"
            onClick={handleSubmit}
            disabled={loading || !password}
            style={{ background: '#B8945F', color: '#FAFAF7', borderColor: 'transparent' }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Componente: Admin Panel
// ============================================================
function AdminPanel({ visible, onClose, token, photos, onReload }: {
  visible: boolean
  onClose: () => void
  token: string
  photos: PhotoItem[]
  onReload: () => void
}) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const showToast = useShowToast()

  const handleDelete = useCallback(async (photo: PhotoItem) => {
    if (!confirm(`¿Eliminar "${photo.filename}"?`)) return
    setDeleting(photo.id)
    const result = await deletePhoto(photo.id, token)
    if (result.success) {
      showToast('Foto eliminada', 'success')
      onReload()
    } else {
      showToast(`Error: ${result.message}`, 'error')
    }
    setDeleting(null)
  }, [token, onReload, showToast])

  const imageCount = photos.filter(p => p.type === 'image').length
  const videoCount = photos.filter(p => p.type === 'video').length

  return (
    <div
      className={`np-modal-backdrop ${visible ? 'np-visible' : ''}`}
      onClick={onClose}
    >
      <div className="np-modal np-admin-panel" onClick={e => e.stopPropagation()}>
        <h2>Panel de administración</h2>
        <div className="subtitle">
          Gestiona las fotos subidas
        </div>

        <div className="np-admin-stats">
          <div className="np-admin-stat">
            <div className="num">{photos.length}</div>
            <div className="label">Total</div>
          </div>
          <div className="np-admin-stat">
            <div className="num">{imageCount}</div>
            <div className="label">Fotos</div>
          </div>
          <div className="np-admin-stat">
            <div className="num">{videoCount}</div>
            <div className="label">Videos</div>
          </div>
        </div>

        <h3>Archivos subidos</h3>
        {photos.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(42,38,32,0.5)' }}>
            No hay fotos subidas aún
          </div>
        ) : (
          <div className="np-admin-file-list">
            {photos.map(photo => (
              <div key={photo.id} className="np-admin-file-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photo.type === 'image' ? (
                  <img className="thumb" src={photo.path} alt={photo.filename} />
                ) : (
                  <div className="thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8945F', fontSize: 20 }}>▶</div>
                )}
                <div className="info">
                  <div className="name">{photo.caption || photo.filename}</div>
                  <div className="meta">
                    {(photo.size / 1024).toFixed(0)} KB · {photo.filename}
                  </div>
                </div>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(photo)}
                  disabled={deleting === photo.id}
                >
                  {deleting === photo.id ? '...' : 'Eliminar'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button className="btn" onClick={onClose}>Cerrar</button>
          <button className="btn" onClick={onReload}>Recargar</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Toast context (simple)
// ============================================================
function useShowToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const fn = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])
  ;(fn as any)._toast = toast
  return fn
}

function Toast({ toast }: { toast: { message: string; type: 'success' | 'error' | 'info' } | null }) {
  if (!toast) return null
  return <div className={`np-toast visible ${toast.type}`}>{toast.message}</div>
}

// ============================================================
// Componente principal
// ============================================================
export default function AnimacionPedida() {
  const particlesRef = useRef<HTMLDivElement>(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [mode, setMode] = useState<AppMode>('home')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Inyectar CSS
  useEffect(() => {
    const styleId = 'np-styles'
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = ANIMATION_CSS
    document.head.appendChild(style)
  }, [])

  // Cursor
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setCursorPos({ x: e.clientX, y: e.clientY })
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      setIsHovering(!!target.closest('button, a, .np-dropzone, [role="button"]'))
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseover', handleMouseOver)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseover', handleMouseOver)
    }
  }, [])

  // Cargar fotos iniciales
  const loadPhotos = useCallback(async () => {
    const data = await fetchPhotos()
    if (data.success) {
      setPhotos(data.items)
      console.log(`Fotos cargadas: ${data.count} (${data.source})`)
    }
  }, [])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  // Auto-refresh cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      loadPhotos()
    }, CONFIG.storage.refreshIntervalMin * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadPhotos])

  // Verificar si hay sesión admin guardada
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    if (savedToken) {
      verifyAdminToken(savedToken).then(valid => {
        if (valid) setAdminToken(savedToken)
        else localStorage.removeItem('admin_token')
      })
    }
  }, [])

  // Partículas
  useParticles(particlesRef)

  // Handlers
  const handleSlideshow = useCallback(() => setMode('slideshow'), [])
  const handleUpload = useCallback(() => setShowUpload(true), [])
  const handleAdminOpen = useCallback(() => {
    if (adminToken) setShowAdminPanel(true)
    else setShowAdminLogin(true)
  }, [adminToken])

  const handleAdminSuccess = useCallback((token: string) => {
    setAdminToken(token)
    localStorage.setItem('admin_token', token)
    setShowAdminLogin(false)
    setShowAdminPanel(true)
  }, [])

  const handleAdminClose = useCallback(() => {
    setShowAdminPanel(false)
  }, [])

  const handleAdminLogout = useCallback(() => {
    setAdminToken(null)
    localStorage.removeItem('admin_token')
    setShowAdminPanel(false)
    showToast('Sesión cerrada', 'info')
  }, [showToast])

  return (
    <div className="np-stage">
      {/* Capas decorativas */}
      <div className="np-particles" ref={particlesRef}></div>
      <div className="np-vignette"></div>

      {/* Home screen */}
      {mode === 'home' && (
        <HomeScreen onSlideshow={handleSlideshow} onUpload={handleUpload} />
      )}

      {/* Slideshow */}
      {mode === 'slideshow' && (
        <Slideshow
          photos={photos}
          onExit={() => setMode('home')}
        />
      )}

      {/* Admin Lock (solo desktop) */}
      {mode === 'home' && (
        <AdminLock onOpenAdmin={handleAdminOpen} />
      )}

      {/* Upload Modal */}
      <UploadModal
        visible={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={loadPhotos}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal
        visible={showAdminLogin}
        onClose={() => setShowAdminLogin(false)}
        onSuccess={handleAdminSuccess}
      />

      {/* Admin Panel Modal */}
      <AdminPanel
        visible={showAdminPanel}
        onClose={handleAdminClose}
        token={adminToken || ''}
        photos={photos}
        onReload={loadPhotos}
      />

      {/* Cursor */}
      <div className="np-cursor-dot" style={{ left: cursorPos.x, top: cursorPos.y }}></div>
      <div
        className={`np-cursor-ring ${isHovering ? 'np-hover' : ''}`}
        style={{ left: cursorPos.x, top: cursorPos.y }}
      ></div>

      {/* Toast */}
      <Toast toast={toast} />
    </div>
  )
}
