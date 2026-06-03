import { Button } from '@/components/ui/button'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect, forwardRef } from 'react'

export const ThemeToggle = forwardRef<
  HTMLButtonElement,
  {
    className?: string
  }
>(({ className, ...props }, ref) => {
  // Theme toggle is disabled - app is forced to dark mode
  return null
})

ThemeToggle.displayName = 'ThemeToggle'
