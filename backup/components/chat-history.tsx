'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  MessageSquare, 
  Search, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Calendar,
  Download,
  Archive,
  Hash,
  Clock
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ChatSession } from '@/lib/database.types'

interface ChatHistoryProps {
  sessions: ChatSession[]
  currentSessionId?: string
  loading?: boolean
  onSessionSelect: (sessionId: string) => void
  onSessionCreate: () => void
  onSessionDelete: (sessionId: string) => void
  onSessionRename: (sessionId: string, title: string) => void
  className?: string
}

export function ChatHistory({
  sessions,
  currentSessionId,
  loading,
  onSessionSelect,
  onSessionCreate,
  onSessionDelete,
  onSessionRename,
  className,
}: ChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingSession, setEditingSession] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deletingSession, setDeletingSession] = useState<ChatSession | null>(null)

  const filteredSessions = sessions.filter(session =>
    session.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.template?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedSessions = {
    today: filteredSessions.filter(session => {
      const sessionDate = new Date(session.last_activity)
      const today = new Date()
      return sessionDate.toDateString() === today.toDateString()
    }),
    yesterday: filteredSessions.filter(session => {
      const sessionDate = new Date(session.last_activity)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return sessionDate.toDateString() === yesterday.toDateString()
    }),
    lastWeek: filteredSessions.filter(session => {
      const sessionDate = new Date(session.last_activity)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return sessionDate > weekAgo && sessionDate < yesterday
    }),
    older: filteredSessions.filter(session => {
      const sessionDate = new Date(session.last_activity)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return sessionDate <= weekAgo
    })
  }

  const handleSessionRename = (sessionId: string) => {
    if (editTitle.trim()) {
      onSessionRename(sessionId, editTitle.trim())
      setEditingSession(null)
      setEditTitle('')
    }
  }

  const startEditing = (session: ChatSession) => {
    setEditingSession(session.session_id)
    setEditTitle(session.title || '')
  }

  const handleDeleteConfirm = () => {
    if (deletingSession) {
      onSessionDelete(deletingSession.session_id)
      setDeletingSession(null)
    }
  }

  const SessionItem = ({ session }: { session: ChatSession }) => {
    const isActive = session.session_id === currentSessionId
    const isEditing = editingSession === session.session_id

    return (
      <div
        className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-primary/5 dark:hover:bg-accent ${
          isActive ? 'bg-accent border border-border' : ''
        }`}
        onClick={() => !isEditing && onSessionSelect(session.session_id)}
      >
        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => handleSessionRename(session.session_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSessionRename(session.session_id)
                } else if (e.key === 'Escape') {
                  setEditingSession(null)
                  setEditTitle('')
                }
              }}
              className="h-6 px-1 text-sm"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <div className="text-sm font-medium truncate">
                {session.title || 'Untitled Chat'}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                <span>{session.message_count}</span>
                <Clock className="h-3 w-3 ml-1" />
                <span>{formatDistanceToNow(new Date(session.last_activity), { addSuffix: true })}</span>
              </div>
              {(session.model || session.template) && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  {session.model && <span className="bg-secondary px-1 rounded">{session.model}</span>}
                  {session.template && <span className="bg-secondary px-1 rounded">{session.template}</span>}
                </div>
              )}
            </>
          )}
        </div>

        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => startEditing(session)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setDeletingSession(session)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    )
  }

  const SessionGroup = ({ title, sessions }: { title: string; sessions: ChatSession[] }) => {
    if (sessions.length === 0) return null

    return (
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          {title}
        </h3>
        <div className="space-y-1">
          {sessions.map(session => (
            <SessionItem key={session.session_id} session={session} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Chat History</h2>
          <Button
            onClick={onSessionCreate}
            size="sm"
            className="h-8 w-8 p-0"
            title="New Chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Session List */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No chats found' : 'No chat history yet'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={onSessionCreate}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Start your first chat
                </Button>
              )}
            </div>
          ) : (
            <>
              <SessionGroup title="Today" sessions={groupedSessions.today} />
              <SessionGroup title="Yesterday" sessions={groupedSessions.yesterday} />
              <SessionGroup title="Last 7 days" sessions={groupedSessions.lastWeek} />
              <SessionGroup title="Older" sessions={groupedSessions.older} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{sessions.length} total chats</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open('/api/chat/export?format=json')}>
                <Download className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('/api/chat/export?format=csv')}>
                <Download className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingSession} onOpenChange={() => setDeletingSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingSession?.title || 'Untitled Chat'}&rdquo;? 
              This action cannot be undone and will permanently delete all messages in this chat session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingSession(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}