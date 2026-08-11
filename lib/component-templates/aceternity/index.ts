import type { ComponentTemplate } from '../index'
import { registerComponents } from '../index'

const aceternityComponents: ComponentTemplate[] = [
  {
    name: '3D Card Effect',
    category: 'card',
    sourceCode: `"use client"
import { useState, useRef } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

export function Card3D({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15 })
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15 })
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    x.set(mouseX / width - 0.5)
    y.set(mouseY / height - 0.5)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
      className={className}
    >
      <div style={{ transform: "translateZ(40px)" }}>{children}</div>
    </motion.div>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: 'Cards that tilt in 3D following the mouse cursor with spring physics',
    provider: 'aceternity',
    tags: ['3d', 'card', 'interactive', 'hover', 'tilt', 'mouse'],
  },
  {
    name: 'Spotlight',
    category: 'background',
    sourceCode: `"use client"
import { useRef, useEffect } from "react"

export function Spotlight({ className }: { className?: string }) {
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!divRef.current) return
      const { left, top, width, height } = divRef.current.getBoundingClientRect()
      const x = e.clientX - left
      const y = e.clientY - top
      divRef.current.style.setProperty("--mouse-x", \`\${x}px\`)
      divRef.current.style.setProperty("--mouse-y", \`\${y}px\`)
    }
    const el = divRef.current
    el?.addEventListener("mousemove", handleMouseMove)
    return () => el?.removeEventListener("mousemove", handleMouseMove)
  }, [])

  return (
    <div
      ref={divRef}
      className={\`absolute inset-0 overflow-hidden [background:radial-gradient(600px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(255,255,255,0.06),transparent_40%)] \${className || ""}\`}
    />
  )
}`,
    dependencies: [],
    previewDescription: 'A radial gradient spotlight that follows the mouse cursor',
    provider: 'aceternity',
    tags: ['spotlight', 'background', 'mouse', 'gradient', 'interactive', 'glow'],
  },
  {
    name: 'Background Gradient',
    category: 'background',
    sourceCode: `"use client"
import { motion } from "framer-motion"

export function BackgroundGradient({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={\`relative group/card \${className || ""}\`}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/20 via-transparent to-blue-500/20 opacity-0 group-hover/card:opacity-100 transition duration-500" />
      {children}
    </div>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: 'Animated gradient background that reveals on hover',
    provider: 'aceternity',
    tags: ['gradient', 'background', 'hover', 'animated', 'card'],
  },
  {
    name: 'Pin Container',
    category: 'card',
    sourceCode: `"use client"
import { useState, useRef } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

export function PinContainer({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const xSpring = useSpring(x, { stiffness: 100, damping: 15 })
  const ySpring = useSpring(y, { stiffness: 100, damping: 15 })
  const rotateX = useTransform(ySpring, [-0.5, 0.5], ["8deg", "-8deg"])
  const rotateY = useTransform(xSpring, [-0.5, 0.5], ["-8deg", "8deg"])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  return (
    <div className="perspective-1000" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative"
      >
        {children}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: hovered ? 1 : 0 }}
          className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 rounded-xl pointer-events-none"
        />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? -5 : 10 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium"
        >
          {title}
        </motion.p>
      </motion.div>
    </div>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: '3D pin container that tilts on hover with title reveal',
    provider: 'aceternity',
    tags: ['pin', 'card', '3d', 'hover', 'interactive', 'tilt'],
  },
  {
    name: 'Magnetic Button',
    category: 'button',
    sourceCode: `"use client"
import { useRef, useState } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

export function MagneticButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 150, damping: 15 })
  const springY = useSpring(y, { stiffness: 150, damping: 15 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set((e.clientX - centerX) * 0.15)
    y.set((e.clientY - centerY) * 0.15)
  }

  const handleMouseLeave = () => { x.set(0); y.set(0) }

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}
    </motion.button>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: 'Button that magnetically follows the mouse cursor',
    provider: 'aceternity',
    tags: ['button', 'magnetic', 'interactive', 'hover', 'spring'],
  },
  {
    name: 'Glowing Beam',
    category: 'background',
    sourceCode: `"use client"
import { motion } from "framer-motion"

export function GlowingBeam({ className }: { className?: string }) {
  return (
    <div className={\`relative overflow-hidden \${className || ""}\`}>
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "linear-gradient(90deg, transparent, rgba(120,119,198,0.5), transparent)",
            "linear-gradient(90deg, transparent, rgba(120,119,198,0.5), transparent)",
          ],
          backgroundPosition: ["0% 50%", "200% 50%"],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
    </div>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: 'Animated glowing beam that sweeps across the background',
    provider: 'aceternity',
    tags: ['beam', 'glow', 'background', 'animated', 'light'],
  },
  {
    name: 'Text Reveal',
    category: 'text',
    sourceCode: `"use client"
import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

export function TextReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 20%"] })
  const opacity = useTransform(scrollYProgress, [0, 1], [0.1, 1])

  return (
    <motion.p ref={ref} style={{ opacity }} className={className}>
      {text}
    </motion.p>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: 'Text that fades in as you scroll through it',
    provider: 'aceternity',
    tags: ['text', 'scroll', 'reveal', 'fade', 'animation'],
  },
  {
    name: 'Parallax Scroll',
    category: 'background',
    sourceCode: `"use client"
import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

export function ParallaxScroll({ children, className, speed = 0.5 }: { children: React.ReactNode; className?: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref })
  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100])

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: 'Content that moves at a different speed than the page scroll',
    provider: 'aceternity',
    tags: ['parallax', 'scroll', 'background', 'animation', 'movement'],
  },
  {
    name: 'Hover Border Gradient',
    category: 'card',
    sourceCode: `"use client"
import { useState, useRef } from "react"
import { motion } from "framer-motion"

export function HoverBorderGradient({ children, className }: { children: React.ReactNode; className?: string }) {
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={\`relative rounded-xl \${className || ""}\`}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: hovered ? 1 : 0,
          background: \`radial-gradient(400px circle at \${mousePos.x}px \${mousePos.y}px, rgba(120,119,198,0.4), transparent 40%)\`,
        }}
      />
      <div className="relative bg-black/80 rounded-xl border border-white/10">{children}</div>
    </div>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: 'Card with an animated border gradient that follows the mouse',
    provider: 'aceternity',
    tags: ['card', 'border', 'gradient', 'hover', 'interactive', 'mouse'],
  },
  {
    name: 'Floating Navbar',
    category: 'navigation',
    sourceCode: `"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export function FloatingNavbar({ children, className }: { children: React.ReactNode; className?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 100)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className={\`fixed top-4 left-1/2 -translate-x-1/2 z-50 backdrop-blur-xl bg-black/60 border border-white/10 rounded-full px-6 py-3 \${className || ""}\`}
        >
          {children}
        </motion.nav>
      )}
    </AnimatePresence>
  )
}`,
    dependencies: ['framer-motion'],
    previewDescription: 'Navigation bar that appears with animation when scrolling down',
    provider: 'aceternity',
    tags: ['navbar', 'navigation', 'floating', 'scroll', 'fixed', 'animated'],
  },
]

registerComponents(aceternityComponents)
