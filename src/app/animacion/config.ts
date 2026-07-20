'use client'

/**
 * Configuración principal — Editar aquí para personalizar
 */
export const CONFIG = {
  couple: {
    initials: "D & W",
    names: "Daniela & William",
    eventDate: "",
    hashtag: "#NuestraPromesa"
  },

  images: {
    logo: "/images/logo.png",
    photos: [
      "/images/foto1.jpg",
      "/images/foto2.jpg",
      "/images/foto3.jpg",
      "/images/foto4.jpg",
      "/images/foto5.jpg"
    ]
  },

  texts: {
    sceneLogo: {
      title: "Nuestra Promesa",
      subtitle: "D & W",
      tagline: ""
    },
    scenePhotos: [
      { caption: "Para siempre" },
      { caption: "Nuestro comienzo" },
      { caption: "Un sí para siempre" },
      { caption: "Nuestra historia" },
      { caption: "El sí" }
    ],
    sceneFinal: {
      phrase: "Y vivieron felices...",
      signature: "D & W",
      closing: "Gracias por acompañarnos"
    }
  },

  timeline: {
    logoIntro: 8.0,
    photoDuration: 7.0,
    photoTransition: 1.4,
    finalScene: 8.0,
    loopPause: 0
  },

  style: {
    bgColor: "#0a0807",
    accentGold: "#D4AF37",
    textLight: "#F5EFE0",
    textMuted: "rgba(245, 239, 224, 0.6)",
    particles: {
      count: 60,
      minSize: 1,
      maxSize: 4,
      minOpacity: 0.2,
      maxOpacity: 0.8,
      speed: 0.5
    },
    speed: 1.0
  }
} as const
