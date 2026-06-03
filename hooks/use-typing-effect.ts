'use client'

import { useState, useEffect, useCallback } from 'react'

export function useTypingEffect(
  words: string[],
  typingSpeed = 100,
  delay = 1000,
) {
  const [wordIndex, setWordIndex] = useState(0)
  const [text, setText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const type = useCallback(() => {
    const currentWord = words[wordIndex]
    const shouldDelete = isDeleting
    const currentText = text

    if (shouldDelete) {
      setText(currentWord.substring(0, currentText.length - 1))
    } else {
      setText(currentWord.substring(0, currentText.length + 1))
    }

    if (!shouldDelete && currentText === currentWord) {
      setTimeout(() => setIsDeleting(true), delay)
    } else if (shouldDelete && currentText === '') {
      setIsDeleting(false)
      setWordIndex((prev) => (prev + 1) % words.length)
    }
  }, [isDeleting, text, wordIndex, words, delay])

  useEffect(() => {
    const timer = setTimeout(type, typingSpeed)
    return () => clearTimeout(timer)
  }, [type, typingSpeed])

  return text
}
