'use client'

import Image from 'next/image'
import { useTheme } from 'next-themes'
import { ComponentProps } from 'react'

export default function Logo(
  props: Omit<ComponentProps<typeof Image>, 'src' | 'alt'>
) {
  const { theme } = useTheme()
  const src = theme === 'light' ? '/logo-dark.png' : '/logo.png'
  const { width, style } = props

  return (
    <Image
      src={src}
      alt="Magical AI"
      priority
      {...props}
      style={{ ...style, width, height: 'auto' }}
    />
  )
}
