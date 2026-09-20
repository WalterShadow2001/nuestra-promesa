'use client'

export const CONFIG = {
  // === Identidad ===
  couple: {
    initials: "D & W",
    names: "Dariana & Walter",
    eventDate: "26 de Septiembre, 2026",
    eventName: "Boda Civil",
    hashtag: "#BodaDarianaWalter"
  },

  // === Storage ===
  // Google Drive configurado via env vars (GOOGLE_DRIVE_FOLDER_ID, GOOGLE_SERVICE_ACCOUNT_JSON)
  // Si no está configurado, fallback a Turso DB
  storage: {
    refreshIntervalMin: 5,  // Refresh photos from Drive every 5 minutes
  },

  // === Admin ===
  admin: {
    password: "1908",
    sessionDurationHours: 8,  // Session lasts 8 hours
  },

  // === Frases (slideshow) ===
  phrases: {
    photos: [
      { caption: "Juntos para siempre" },
      { caption: "Nuestro día llegó" },
      { caption: "Y vivieron felices" },
      { caption: "El sí que nos unió" },
      { caption: "Hoy celebramos nuestro amor" },
      { caption: "Gracias por acompañarnos" },
      { caption: "Comparte este momento con nosotros" },
      { caption: "Tú eres parte de nuestra historia" },
      { caption: "Y así comenzó nuestra historia" },
      { caption: "Por siempre unidos" },
      { caption: "Nuestra boda, nuestro comienzo" },
      { caption: "El amor nos une" },
    ],
    final: {
      phrase: "Y así comenzó nuestro para siempre",
      signature: "D & W",
      closing: "26 · 09 · 2026 · Gracias por acompañarnos"
    }
  },

  // === Timeline (slideshow) ===
  timeline: {
    photoDuration: 7.0,
    photoTransition: 1.4,
    finalScene: 8.0,
    loopPause: 0
  },

  // === Estilo: Blanco + Dorado elegante ===
  style: {
    bgColor: "#FAFAF7",  // Blanco marfil suave
    bgGradient: "radial-gradient(ellipse at 50% 30%, #FFFEF9 0%, #FAFAF7 50%, #F0EBE0 100%)",
    accentGold: "#B8945F",  // Dorado elegante (no chillón)
    accentGoldSoft: "rgba(184, 148, 95, 0.4)",
    accentGoldDeep: "#8B6B3F",
    textDark: "#2A2620",  // Texto oscuro elegante
    textMuted: "rgba(42, 38, 32, 0.6)",
    textLight: "#FAFAF7",
    fontSerif: "'Cormorant Garamond', 'Playfair Display', 'Times New Roman', serif",
    fontSans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    particles: {
      count: 40,  // Menos partículas, más sutil
      minSize: 1,
      maxSize: 3,
      minOpacity: 0.15,
      maxOpacity: 0.5,
      speed: 0.3
    },
    speed: 1.0
  }
} as const
