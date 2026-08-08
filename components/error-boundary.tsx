'use client'

import React, { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  errorId?: string
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  name?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

let errorLog: Array<{
  id: string
  timestamp: string
  name: string
  message: string
  stack?: string
  componentStack?: string
}> = []

export function getErrorLog() {
  return errorLog
}

export function clearErrorLog() {
  errorLog = []
}

let errorCounter = 0

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    errorCounter++
    const id = `err-${Date.now()}-${errorCounter}`
    return {
      hasError: true,
      error,
      errorId: id,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const boundaryName = this.props.name || 'unknown'
    const errorId = this.state.errorId || `err-${Date.now()}`

    const entry = {
      id: errorId,
      timestamp: new Date().toISOString(),
      name: boundaryName,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
    }

    errorLog = [...errorLog.slice(-49), entry]

    console.error(`[ErrorBoundary:${boundaryName}]`, error, errorInfo)

    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: undefined })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopyError = async () => {
    const { error, errorInfo, errorId } = this.state
    const boundaryName = this.props.name || 'unknown'
    const text = [
      `Error ID: ${errorId}`,
      `Component: ${boundaryName}`,
      `Time: ${new Date().toISOString()}`,
      `Message: ${error?.message}`,
      '',
      'Stack:',
      error?.stack,
      '',
      'Component Stack:',
      errorInfo?.componentStack,
    ].filter(Boolean).join('\n')

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, errorInfo, errorId } = this.state
      const boundaryName = this.props.name || 'Component'

      return (
        <div className="flex h-full min-h-[200px] items-center justify-center bg-[#181818] p-4">
          <div className="w-full max-w-lg rounded-xl border border-red-500/20 bg-[#1a1212] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-red-300">
                  {boundaryName} crashed
                </div>
                <p className="mt-1 text-xs text-white/50">
                  {error?.message || 'An unknown error occurred'}
                </p>
              </div>
            </div>

            <details className="mt-3 group">
              <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60 select-none">
                Error details
              </summary>
              <div className="mt-2 rounded-lg border border-white/5 bg-black/30 p-3">
                {errorId && (
                  <div className="mb-2 text-[10px] text-white/30">
                    ID: {errorId}
                  </div>
                )}
                <pre className="max-h-40 overflow-auto text-[11px] leading-4 text-red-300/80 whitespace-pre-wrap break-all">
                  {error?.message}
                  {'\n\n'}
                  {error?.stack}
                  {errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:\n'}
                      {errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </div>
            </details>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={this.handleCopyError}
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-white/10 text-xs text-white/60 hover:bg-white/5"
              >
                <Copy className="h-3 w-3" />
                Copy error
              </Button>
              <Button
                onClick={this.handleReset}
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-white/10 text-xs text-white/60 hover:bg-white/5"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </Button>
              <Button
                onClick={this.handleReload}
                size="sm"
                className="h-7 gap-1.5 text-xs"
              >
                Reload page
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

export function useErrorHandler() {
  return useCallback((error: Error, errorInfo?: any) => {
    console.error('Error:', error, errorInfo)
  }, [])
}

export function LoadingFallback({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export function SettingsSection({ children, title, description }: {
  children: React.ReactNode
  title?: string
  description?: string
}) {
  return (
    <ErrorBoundary
      name={title || 'Settings Section'}
      fallback={
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            {title || 'Section'} Unavailable
          </div>
          <p className="mt-1 text-xs text-white/40">
            {description || 'This section could not be loaded.'}
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
