import { v4 as uuidv4 } from 'uuid'

interface TelemetryEvent {
  eventName: string
  eventProperties: Record<string, any>
  teamId?: string
  sessionId?: string
}

class TelemetryService {
  private static instance: TelemetryService
  private queue: TelemetryEvent[] = []
  private sessionId: string
  private timer: NodeJS.Timeout | null = null

  private constructor() {
    this.sessionId = uuidv4()
    this.start()
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService()
    }
    return TelemetryService.instance
  }

  public track(eventName: string, eventProperties: Record<string, any>, teamId?: string) {
    this.queue.push({
      eventName,
      eventProperties,
      teamId,
      sessionId: this.sessionId,
    })
  }

  private start() {
    this.timer = setInterval(() => {
      this.flush()
    }, 5000) // Flush every 5 seconds
  }

  private async flush() {
    if (this.queue.length === 0) {
      return
    }

    const events = [...this.queue]
    this.queue = []

    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      })
    } catch (error) {
      console.error('Failed to send telemetry events:', error)
      // Add events back to the queue to retry later
      this.queue.unshift(...events)
    }
  }
}

export const telemetryService = TelemetryService.getInstance()
