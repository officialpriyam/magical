import type { ComponentTemplate } from '../index'
import { registerComponents } from '../index'

const magicUIComponents: ComponentTemplate[] = [
  {
    name: 'Marquee',
    category: 'animation',
    sourceCode: '"use client"\nimport { cn } from "@/lib/utils"\n\ninterface MarqueeProps {\n  children: React.ReactNode\n  className?: string\n  reverse?: boolean\n  pauseOnHover?: boolean\n  speed?: number\n}\n\nexport function Marquee({ children, className, reverse, pauseOnHover, speed = 40 }: MarqueeProps) {\n  return (\n    <div className={cn("flex w-max overflow-hidden [--gap:1rem]", className)}>\n      <div className={cn("flex shrink-0 items-center justify-around gap-[--gap]", reverse && "[animation-direction:reverse]")} style={{ animationDuration: speed + "s" }} onMouseEnter={(e) => pauseOnHover && (e.currentTarget.style.animationPlayState = "paused")} onMouseLeave={(e) => pauseOnHover && (e.currentTarget.style.animationPlayState = "running")}>\n        {children}\n      </div>\n      <div className={cn("flex shrink-0 items-center justify-around gap-[--gap]", reverse && "[animation-direction:reverse]")} style={{ animationDuration: speed + "s" }} aria-hidden>\n        {children}\n      </div>\n    </div>\n  )\n}',
    dependencies: [],
    previewDescription: 'Infinite scrolling marquee with pause on hover',
    provider: 'magicui' as const,
    tags: ['marquee', 'scroll', 'animation', 'infinite', 'text'],
  },
  {
    name: 'Animated Number',
    category: 'animation',
    sourceCode: '"use client"\nimport { useEffect, useRef, useState } from "react"\nimport { useInView } from "framer-motion"\n\nexport function AnimatedNumber({ value, className }: { value: number; className?: string }) {\n  const ref = useRef<HTMLSpanElement>(null)\n  const isInView = useInView(ref, { once: true })\n  const [display, setDisplay] = useState(0)\n\n  useEffect(() => {\n    if (!isInView) return\n    let start = 0\n    const duration = 1500\n    const step = (timestamp: number) => {\n      if (!start) start = timestamp\n      const progress = Math.min((timestamp - start) / duration, 1)\n      setDisplay(Math.floor(progress * value))\n      if (progress < 1) requestAnimationFrame(step)\n    }\n    requestAnimationFrame(step)\n  }, [isInView, value])\n\n  return <span ref={ref} className={className}>{display.toLocaleString()}</span>\n}',
    dependencies: ['framer-motion'],
    previewDescription: 'Numbers that count up from 0 when they scroll into view',
    provider: 'magicui' as const,
    tags: ['number', 'counter', 'animation', 'count', 'scroll'],
  },
  {
    name: 'Dock',
    category: 'navigation',
    sourceCode: '"use client"\nimport { useRef, useState } from "react"\nimport { motion, useMotionValue } from "framer-motion"\n\nexport function Dock({ children, className }: { children: React.ReactNode; className?: string }) {\n  const mouseX = useMotionValue(Infinity)\n  return (\n    <motion.div\n      onMouseMove={(e) => mouseX.set(e.pageX)}\n      onMouseLeave={() => mouseX.set(Infinity)}\n      className={"flex items-end gap-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-3 " + (className || "")}\n    >\n      {children}\n    </motion.div>\n  )\n}',
    dependencies: ['framer-motion'],
    previewDescription: 'macOS-style dock with magnification effect on hover',
    provider: 'magicui' as const,
    tags: ['dock', 'navigation', 'macos', 'hover', 'magnification'],
  },
  {
    name: 'Particles',
    category: 'background',
    sourceCode: '"use client"\nimport { useEffect, useRef } from "react"\n\nexport function Particles({ className, count = 50 }: { className?: string; count?: number }) {\n  const canvasRef = useRef<HTMLCanvasElement>(null)\n\n  useEffect(() => {\n    const canvas = canvasRef.current\n    if (!canvas) return\n    const ctx = canvas.getContext("2d")\n    if (!ctx) return\n    canvas.width = canvas.offsetWidth\n    canvas.height = canvas.offsetHeight\n\n    const particles = Array.from({ length: count }, () => ({\n      x: Math.random() * canvas.width,\n      y: Math.random() * canvas.height,\n      vx: (Math.random() - 0.5) * 0.5,\n      vy: (Math.random() - 0.5) * 0.5,\n      size: Math.random() * 2 + 0.5,\n    }))\n\n    let animId: number\n    const animate = () => {\n      ctx.clearRect(0, 0, canvas.width, canvas.height)\n      particles.forEach((p) => {\n        p.x += p.vx\n        p.y += p.vy\n        if (p.x < 0 || p.x > canvas.width) p.vx *= -1\n        if (p.y < 0 || p.y > canvas.height) p.vy *= -1\n        ctx.beginPath()\n        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)\n        ctx.fillStyle = "rgba(255,255,255,0.3)"\n        ctx.fill()\n      })\n      animId = requestAnimationFrame(animate)\n    }\n    animate()\n    return () => cancelAnimationFrame(animId)\n  }, [count])\n\n  return <canvas ref={canvasRef} className={"absolute inset-0 pointer-events-none " + (className || "")} />\n}',
    dependencies: [],
    previewDescription: 'Floating particle animation background with canvas',
    provider: 'magicui' as const,
    tags: ['particles', 'background', 'animation', 'canvas', 'floating'],
  },
  {
    name: 'Word Rotate',
    category: 'text',
    sourceCode: '"use client"\nimport { useState, useEffect } from "react"\nimport { motion, AnimatePresence } from "framer-motion"\n\nexport function WordRotate({ words, className, duration = 2500 }: { words: string[]; className?: string; duration?: number }) {\n  const [index, setIndex] = useState(0)\n\n  useEffect(() => {\n    const interval = setInterval(() => setIndex((prev) => (prev + 1) % words.length), duration)\n    return () => clearInterval(interval)\n  }, [words.length, duration])\n\n  return (\n    <div className={"relative h-[1.2em] overflow-hidden " + (className || "")}>\n      <AnimatePresence mode="wait">\n        <motion.span\n          key={index}\n          initial={{ y: 50, opacity: 0 }}\n          animate={{ y: 0, opacity: 1 }}\n          exit={{ y: -50, opacity: 0 }}\n          transition={{ duration: 0.3 }}\n          className="absolute"\n        >\n          {words[index]}\n        </motion.span>\n      </AnimatePresence>\n    </div>\n  )\n}',
    dependencies: ['framer-motion'],
    previewDescription: 'Words that rotate with a sliding animation',
    provider: 'magicui' as const,
    tags: ['text', 'rotate', 'animation', 'words', 'hero'],
  },
  {
    name: 'Shimmer Button',
    category: 'button',
    sourceCode: '"use client"\n\nexport function ShimmerButton({ children, className }: { children: React.ReactNode; className?: string }) {\n  return (\n    <button\n      className={"relative overflow-hidden rounded-lg px-6 py-3 font-medium text-white transition-all bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent " + (className || "")}\n    >\n      {children}\n    </button>\n  )\n}',
    dependencies: [],
    previewDescription: 'Button with an animated shimmer effect on hover',
    provider: 'magicui' as const,
    tags: ['button', 'shimmer', 'hover', 'gradient', 'animated'],
  },
  {
    name: 'CSS Grid Background',
    category: 'background',
    sourceCode: '"use client"\n\nexport function CSSGridBackground({ className }: { className?: string }) {\n  return (\n    <div\n      className={"absolute inset-0 [background-size:40px_40px] [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] " + (className || "")}\n    />\n  )\n}',
    dependencies: [],
    previewDescription: 'Subtle CSS grid pattern background',
    provider: 'magicui' as const,
    tags: ['grid', 'background', 'pattern', 'css', 'subtle'],
  },
]

registerComponents(magicUIComponents)
