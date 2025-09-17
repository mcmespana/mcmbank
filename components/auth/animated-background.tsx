"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  color: string
  life: number
  initialLife: number
  type: "orb" | "sparkle"
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>(0)
  const lastThemeRef = useRef<string>("")

  const getThemeColors = () => {
    if (document.body.classList.contains('dark')) {
      return {
        background: "hsl(222, 47%, 11%)",
        primary: "hsl(217, 91%, 60%)",
        accent: "hsl(260, 80%, 70%)",
        secondary: "hsl(215, 28%, 17%)",
      }
    }
    return {
      background: "hsl(0, 0%, 100%)",
      primary: "hsl(222.2, 47.4%, 11.2%)",
      accent: "hsl(260, 80%, 70%)",
      secondary: "hsl(210, 40%, 96.1%)",
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const themeColors = getThemeColors()

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticle = (x?: number, y?: number): Particle => {
      const isOrb = Math.random() > 0.1
      const size = isOrb ? Math.random() * 3 + 2 : Math.random() * 1.5 + 0.5
      const life = isOrb ? Math.random() * 100 + 150 : Math.random() * 50 + 50

      return {
        x: x ?? Math.random() * canvas.width,
        y: y ?? Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: size,
        opacity: isOrb ? Math.random() * 0.3 + 0.2 : Math.random() * 0.5 + 0.3,
        color: Math.random() > 0.3 ? themeColors.primary : themeColors.accent,
        life: life,
        initialLife: life,
        type: isOrb ? "orb" : "sparkle",
      }
    }

    const createParticles = () => {
      const particleCount = Math.floor((canvas.width * canvas.height) / 20000)
      particlesRef.current = []
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push(createParticle())
      }
    }

    const drawParticle = (particle: Particle) => {
      ctx.save()
      const opacity = particle.type === 'orb'
        ? (particle.life / particle.initialLife) * particle.opacity
        : Math.sin((particle.life / particle.initialLife) * Math.PI) * particle.opacity

      ctx.globalAlpha = Math.max(0, opacity)
      ctx.fillStyle = particle.color

      if (particle.type === "orb") {
        ctx.shadowBlur = 15
        ctx.shadowColor = particle.color
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.shadowBlur = 5
        ctx.shadowColor = particle.color
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
      }

      ctx.restore()
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particlesRef.current.forEach((particle, index) => {
        particle.x += particle.vx
        particle.y += particle.vy
        particle.life--

        if (particle.life <= 0) {
          particlesRef.current.splice(index, 1)
          if (particlesRef.current.length < 50) { // Keep particle count stable
             particlesRef.current.push(createParticle())
          }
          return
        }

        if (particle.x < 0 || particle.x > canvas.width || particle.y < 0 || particle.y > canvas.height) {
            particle.life = 0 // Mark for removal if it goes off-screen
        }

        drawParticle(particle)
      })

      // Add new particles occasionally
      if (Math.random() > 0.95 && particlesRef.current.length < 70) {
        particlesRef.current.push(createParticle())
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    const init = () => {
      resizeCanvas()
      createParticles()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      animate()
    }

    init()

    const handleResize = () => {
      resizeCanvas()
      createParticles()
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === 'class') {
          const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light'
          if(currentTheme !== lastThemeRef.current) {
            lastThemeRef.current = currentTheme
            init()
          }
        }
      })
    })

    observer.observe(document.body, { attributes: true })
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      observer.disconnect()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none -z-10" />
}
