'use client'

import { telemetryService } from '@/lib/telemetry-service'
import React from 'react'

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    telemetryService.track('app_load', {})
  }, [])

  return <>{children}</>
}
