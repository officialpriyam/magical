import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { getFromCache, setInCache, invalidateCache } from './caching'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  model?: string
  template?: string
  metadata?: {
    userID?: string
    teamID?: string
    executionTime?: number
    tokenCount?: number
    cost?: number
  }
}

export interface ChatSession {
  sessionId: string
  userId: string
  teamId?: string
  createdAt: string
  lastActivity: string
  messageCount: number
  title?: string
  tags?: string[]
  model?: string
  template?: string
  status: 'active' | 'archived' | 'deleted'
}

export interface UserChatSummary {
  userId: string
  totalSessions: number
  totalMessages: number
  lastActivity: string
  favoriteModels: string[]
  favoriteTemplates: string[]
  totalTokensUsed?: number
  totalCost?: number
}

export class SupabaseChatPersistence {
  /**
   * Create a new chat session
   */
  static async createSession(
    userId: string,
    teamId?: string,
    initialMessage?: Omit<ChatMessage, 'sessionId' | 'id' | 'timestamp'>
  ): Promise<ChatSession> {
    const sessionId = uuidv4()
    const now = new Date().toISOString()

    const session: ChatSession = {
      sessionId,
      userId,
      teamId,
      createdAt: now,
      lastActivity: now,
      messageCount: initialMessage ? 1 : 0,
      title: initialMessage ? ChatUtils.generateSessionTitle(initialMessage.content) : 'New Chat',
      model: initialMessage?.model,
      template: initialMessage?.template,
      status: 'active',
    }

    // Insert session into database
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        session_id: sessionId,
        user_id: userId,
        team_id: teamId,
        title: session.title,
        status: session.status,
        message_count: session.messageCount,
        model: session.model,
        template: session.template,
        created_at: session.createdAt,
        updated_at: session.createdAt,
        last_activity: session.lastActivity,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating chat session:', error)
      throw new Error(`Failed to create session: ${error.message}`)
    }

    // Save initial message if provided
    if (initialMessage) {
      await this.addMessage(userId, sessionId, initialMessage)
    }

    return session
  }

  /**
   * Add a message to an existing session
   */
  static async addMessage(
    userId: string,
    sessionId: string,
    message: Omit<ChatMessage, 'sessionId' | 'id' | 'timestamp'>
  ): Promise<ChatMessage> {
    invalidateCache(`sessions:${userId}`)
    invalidateCache(`messages:${sessionId}`)
    const now = new Date().toISOString()
    const messageId = uuidv4()
    const newMessage: ChatMessage = {
      ...message,
      id: messageId,
      sessionId,
      timestamp: now,
    }

    // Get session database ID
    const { data: sessionData, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single()

    if (sessionError || !sessionData) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Insert message into cache
    const { error: messageError } = await supabase
      .from('chat_message_cache')
      .insert({
        session_id: sessionData.id,
        message_id: messageId,
        role: message.role,
        content: message.content,
        model: message.model,
        template: message.template,
        token_count: message.metadata?.tokenCount,
        execution_time_ms: message.metadata?.executionTime,
        created_at: now,
      })

    if (messageError) {
      console.error('Error adding message:', messageError)
      throw new Error(`Failed to add message: ${messageError.message}`)
    }

    return newMessage
  }

  /**
   * Get all messages for a session
   */
  static async getSessionMessages(userId: string, sessionId: string): Promise<ChatMessage[]> {
    const cacheKey = `messages:${sessionId}`
    const cachedMessages = getFromCache<ChatMessage[]>(cacheKey)
    if (cachedMessages) {
      return cachedMessages
    }

    const { data, error } = await supabase
      .from('chat_message_cache')
      .select(`
        message_id,
        role,
        content,
        model,
        template,
        token_count,
        execution_time_ms,
        created_at,
        session_id
      `)
      .eq('session_id', (
        await supabase
          .from('chat_sessions')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .single()
      ).data?.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching session messages:', error)
      return []
    }

    const messages = data.map(row => ({
      id: row.message_id,
      sessionId,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: row.created_at,
      model: row.model,
      template: row.template,
      metadata: {
        tokenCount: row.token_count,
        executionTime: row.execution_time_ms,
      }
    }))

    setInCache(cacheKey, messages)
    return messages
  }

  /**
   * Get session metadata
   */
  static async getSession(userId: string, sessionId: string): Promise<ChatSession | null> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return {
      sessionId: data.session_id,
      userId: data.user_id,
      teamId: data.team_id,
      createdAt: data.created_at,
      lastActivity: data.last_activity,
      messageCount: data.message_count,
      title: data.title,
      model: data.model,
      template: data.template,
      status: data.status as 'active' | 'archived' | 'deleted',
    }
  }

  /**
   * List all sessions for a user
   */
  static async getUserSessions(userId: string, limit = 50): Promise<ChatSession[]> {
    const cacheKey = `sessions:${userId}:${limit}`
    const cachedSessions = getFromCache<ChatSession[]>(cacheKey)
    if (cachedSessions) {
      return cachedSessions
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('last_activity', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching user sessions:', error)
      return []
    }

    const sessions = data.map(row => ({
      sessionId: row.session_id,
      userId: row.user_id,
      teamId: row.team_id,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      messageCount: row.message_count,
      title: row.title,
      model: row.model,
      template: row.template,
      status: row.status as 'active' | 'archived' | 'deleted',
    }))

    setInCache(cacheKey, sessions)
    return sessions
  }

  /**
   * Update session title
   */
  static async updateSessionTitle(userId: string, sessionId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error updating session title:', error)
      throw new Error(`Failed to update session title: ${error.message}`)
    }

    invalidateCache(`sessions:${userId}`)
  }

  /**
   * Archive a session (soft delete)
   */
  static async archiveSession(userId: string, sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error archiving session:', error)
      throw new Error(`Failed to archive session: ${error.message}`)
    }

    invalidateCache(`sessions:${userId}`)
  }

  /**
   * Delete a session permanently
   */
  static async deleteSession(userId: string, sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting session:', error)
      throw new Error(`Failed to delete session: ${error.message}`)
    }

    invalidateCache(`sessions:${userId}`)
    invalidateCache(`messages:${sessionId}`)
  }

  /**
   * Search messages across user's sessions
   */
  static async searchMessages(userId: string, query: string, limit = 50): Promise<{ message: ChatMessage; session: ChatSession }[]> {
    if (!query.trim()) {
      return []
    }

    const { data, error } = await supabase.rpc('search_user_messages', {
      p_user_id: userId,
      p_query: query,
      p_limit: limit
    })

    if (error) {
      console.error('Error searching messages:', error)
      return []
    }

    return data.map((row: any) => ({
      message: {
        id: row.message_id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        timestamp: row.created_at,
      },
      session: {
        sessionId: row.session_id,
        userId,
        title: row.session_title,
        createdAt: row.created_at,
        lastActivity: row.created_at,
        messageCount: 0,
        status: 'active' as const,
      }
    }))
  }

  /**
   * Get user chat statistics
   */
  static async getUserSummary(userId: string): Promise<UserChatSummary> {
    const { data, error } = await supabase.rpc('get_user_chat_summary', {
      p_user_id: userId
    })

    if (error || !data || data.length === 0) {
      return {
        userId,
        totalSessions: 0,
        totalMessages: 0,
        lastActivity: new Date().toISOString(),
        favoriteModels: [],
        favoriteTemplates: [],
      }
    }

    const summary = data[0]
    return {
      userId,
      totalSessions: summary.total_sessions || 0,
      totalMessages: summary.total_messages || 0,
      lastActivity: summary.last_activity || new Date().toISOString(),
      favoriteModels: summary.favorite_models || [],
      favoriteTemplates: summary.favorite_templates || [],
      totalTokensUsed: summary.total_tokens,
    }
  }

  /**
   * Export user's chat history
   */
  static async exportUserData(userId: string): Promise<{ sessions: ChatSession[]; messages: Record<string, ChatMessage[]> }> {
    const sessions = await this.getUserSessions(userId, 1000)
    const messages: Record<string, ChatMessage[]> = {}

    for (const session of sessions) {
      try {
        messages[session.sessionId] = await this.getSessionMessages(userId, session.sessionId)
      } catch (error) {
        console.error(`Failed to export messages for session ${session.sessionId}:`, error)
        messages[session.sessionId] = []
      }
    }

    return { sessions, messages }
  }
}

// Utility functions for common operations
export const ChatUtils = {
  /**
   * Generate a session title from the first message
   */
  generateSessionTitle(firstMessage: string): string {
    const cleaned = firstMessage.trim().replace(/\n+/g, ' ')
    if (cleaned.length <= 50) return cleaned
    return cleaned.slice(0, 47) + '...'
  },

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4)
  },

  /**
   * Calculate message statistics
   */
  calculateMessageStats(messages: ChatMessage[]): {
    totalTokens: number
    userMessages: number
    assistantMessages: number
    averageResponseTime?: number
  } {
    let totalTokens = 0
    let userMessages = 0
    let assistantMessages = 0

    messages.forEach(msg => {
      totalTokens += this.estimateTokenCount(msg.content)
      if (msg.role === 'user') userMessages++
      if (msg.role === 'assistant') assistantMessages++
    })

    return {
      totalTokens,
      userMessages,
      assistantMessages,
    }
  },

  /**
   * Format session for display
   */
  formatSessionForDisplay(session: ChatSession): {
    id: string
    title: string
    lastActivity: string
    messageCount: number
    model?: string
    template?: string
  } {
    return {
      id: session.sessionId,
      title: session.title || 'Untitled Chat',
      lastActivity: new Date(session.lastActivity).toLocaleDateString(),
      messageCount: session.messageCount,
      model: session.model,
      template: session.template,
    }
  },
}
