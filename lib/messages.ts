import { FragmentSchema } from './schema'
import { ExecutionResult } from './types'
import { DeepPartial } from 'ai'

export type MessageText = {
  type: 'text'
  text: string
}

export type MessageCode = {
  type: 'code'
  text: string
}

export type MessageImage = {
  type: 'image'
  image: string
}

export type MessagePlan = {
  type: 'plan'
  plan: string
  question?: string
  options?: string[]
  allowCustomInput?: boolean
}

export type MessageFileOp = {
  type: 'file_op'
  operation: 'reading' | 'created' | 'editing'
  files: string[]
}

export type MessageWebSearch = {
  type: 'web_search'
  query: string
  results: {
    title: string
    url: string
    favicon?: string
  }[]
}

export type MessageContent = MessageText | MessageCode | MessageImage | MessagePlan | MessageFileOp | MessageWebSearch

export type Message = {
  role: 'assistant' | 'user'
  content: MessageContent[]
  object?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
}

export function formatPlanForModel(plan: MessagePlan) {
  const parts = [`Plan:\n${plan.plan}`]

  if (plan.question) {
    parts.push(`Question:\n${plan.question}`)
  }

  if (plan.options?.length) {
    parts.push(`Options:\n${plan.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}`)
  }

  return parts.join('\n\n')
}

export function toAISDKMessages(messages: Message[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.map((content) => {
      if (content.type === 'code') {
        return {
          type: 'text',
          text: content.text,
        }
      }

      if (content.type === 'plan') {
        return {
          type: 'text',
          text: formatPlanForModel(content),
        }
      }

      if (content.type === 'file_op') {
        return {
          type: 'text',
          text: `[${content.operation === 'reading' ? 'Reading' : content.operation === 'created' ? 'Created' : 'Editing'}: ${content.files.join(', ')}]`,
        }
      }

      if (content.type === 'web_search') {
        return {
          type: 'text',
          text: `[Search: ${content.query} — ${content.results.map((r) => r.title).join(', ')}]`,
        }
      }

      return content
    }),
  }))
}

export async function toMessageImage(files: File[]) {
  if (files.length === 0) {
    return []
  }

  return Promise.all(
    files.map(async (file) => {
      const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
      return `data:${file.type};base64,${base64}`
    }),
  )
}
