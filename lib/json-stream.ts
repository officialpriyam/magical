export function sanitizeJsonTextStream() {
  let started = false

  const cleanLine = (line: string) => {
    if (/^\s*```(?:json)?\s*$/i.test(line)) return null
    let cleaned = line
    if (/^\s*```(?:json)?/i.test(cleaned)) {
      cleaned = cleaned.replace(/^\s*```(?:json)?\s*/i, '')
    }
    if (/^\s*data:\s*\{/.test(cleaned)) {
      cleaned = cleaned.replace(/^\s*data:\s*/, '')
    }
    return cleaned
  }

  const cleanChunk = (text: string) =>
    text
      .split('\n')
      .map(cleanLine)
      .filter((line): line is string => line !== null)
      .join('\n')

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      if (!started) {
        const start = chunk.indexOf('{')
        if (start === -1) return
        chunk = chunk.slice(start)
        started = true
      }
      const cleaned = cleanChunk(chunk)
      if (cleaned !== '') controller.enqueue(cleaned)
    },
  })
}
