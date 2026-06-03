export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface UserProfile {
  id: string
  user_id: string
  full_name?: string
  display_name?: string
  first_name?: string
  last_name?: string
  work_description?: string
  avatar_url?: string
  onboarding_completed?: boolean
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  id: string
  user_id: string
  ai_assistance: boolean
  smart_suggestions: boolean
  theme: 'light' | 'dark' | 'system'
  font_family: 'inter' | 'jetbrains-mono' | 'cal-sans'
  email_notifications: boolean
  marketing_emails: boolean
  security_alerts: boolean
  analytics_enabled?: boolean
  data_sharing_enabled?: boolean
  telemetry_enabled?: boolean
  auto_template?: string
  created_at: string
  updated_at: string
}

export interface UserIntegration {
  id: string
  user_id: string
  service_name: string
  is_connected: boolean
  connection_data?: Record<string, any>
  last_sync_at?: string
  created_at: string
  updated_at: string
}

export interface UserSecuritySettings {
  id: string
  user_id: string
  two_factor_enabled: boolean
  backup_codes?: string[]
  last_password_change?: string
  login_notifications?: boolean
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  team_id?: string
  title: string
  description?: string
  template_id?: string
  status: 'active' | 'archived' | 'deleted'
  is_public: boolean
  metadata?: Json
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface Fragment {
  id: string
  user_id: string
  project_id?: string
  title: string
  description?: string
  code: string
  language: string
  template_id?: string
  is_public: boolean
  tags?: string[]
  metadata?: Json
  created_at: string
  updated_at: string
}

export interface FragmentExecution {
  id: string
  fragment_id: string
  user_id: string
  execution_status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  sandbox_id?: string
  input_data?: Json
  output_data?: Json
  error_message?: string
  execution_time_ms?: number
  created_at: string
  updated_at: string
}

export interface DbMessage {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: Json
  object_data?: Json
  result_data?: Json
  sequence_number: number
  created_at: string
}

export interface Team {
  id: string
  name: string
  email?: string
  tier: 'free' | 'pro' | 'enterprise'
  stripe_customer_id?: string
  stripe_subscription_id?: string
  subscription_status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete'
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end: boolean
}

export interface UsersTeams {
  user_id: string
  team_id: string
  is_default: boolean
}

export interface TeamUsageLimit {
  team_id: string
  usage_type: 'github_imports' | 'storage_mb' | 'execution_time_seconds' | 'api_calls'
  limit_value: number
  current_usage: number
  period_start: string
  period_end: string
}

export interface UserUsage {
  id: string
  user_id: string
  team_id: string
  usage_type: 'github_imports' | 'storage_mb' | 'execution_time_seconds' | 'api_calls'
  usage_count: number
  metadata?: Json
  created_at: string
}

export interface ConversationThread {
  id: string
  title: string
  description?: string
  created_by: string
  project_id?: string
  is_public: boolean
  metadata?: Json
  created_at: string
  updated_at: string
}

export interface ThreadMessage {
  id: string
  thread_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'code' | 'file' | 'image'
  metadata?: Json
  created_at: string
  updated_at: string
}

export interface ThreadSummary {
  id: string
  thread_id: string
  title: string
  description?: string
  participant_count: number
  message_count: number
  last_message_id?: string
  last_activity_at: string
  created_at: string
  updated_at: string
}

export interface ChatSession {
  id: string
  session_id: string
  user_id: string
  team_id?: string
  created_at: string
  last_activity: string
  message_count: number
  title?: string
  tags?: string[]
  model?: string
  template?: string
  status: 'active' | 'archived' | 'deleted'
  updated_at: string
}

export interface ChatMessageCache {
  id: string
  session_id: string
  message_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  model?: string
  template?: string
  token_count?: number
  execution_time_ms?: number
}

export interface ApiKey {
  id: string
  user_id: string
  name: string
  key_hash: string
  key_prefix: string
  permissions: string[]
  last_used_at?: string
  expires_at?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FileUpload {
  id: string
  user_id: string
  project_id?: string
  filename: string
  file_path: string
  file_url: string
  file_size: number
  mime_type: string
  description?: string
  upload_status: 'pending' | 'uploading' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface SubscriptionEvent {
  id: string
  team_id: string
  stripe_event_id: string
  event_type: string
  event_data: Json
  processed_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<UserProfile>;
      };
      user_preferences: {
        Row: UserPreferences;
        Insert: Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<UserPreferences>;
      };
      user_integrations: {
        Row: UserIntegration;
        Insert: Omit<UserIntegration, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<UserIntegration>;
      };
      user_security_settings: {
        Row: UserSecuritySettings;
        Insert: Omit<UserSecuritySettings, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<UserSecuritySettings>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Project>;
      };
      fragments: {
        Row: Fragment;
        Insert: Omit<Fragment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Fragment>;
      };
      fragment_executions: {
        Row: FragmentExecution;
        Insert: Omit<FragmentExecution, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<FragmentExecution>;
      };
      messages: {
        Row: DbMessage;
        Insert: Omit<DbMessage, 'id' | 'created_at'>;
        Update: Partial<DbMessage>;
      };
      teams: {
        Row: Team;
        Insert: Omit<Team, 'id'>;
        Update: Partial<Team>;
      };
      users_teams: {
        Row: UsersTeams;
        Insert: UsersTeams;
        Update: Partial<UsersTeams>;
      };
      team_usage_limits: {
        Row: TeamUsageLimit;
        Insert: TeamUsageLimit;
        Update: Partial<TeamUsageLimit>;
      };
      user_usage: {
        Row: UserUsage;
        Insert: Omit<UserUsage, 'id' | 'created_at'>;
        Update: Partial<UserUsage>;
      };
      conversation_threads: {
        Row: ConversationThread;
        Insert: Omit<ConversationThread, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<ConversationThread>;
      };
      thread_messages: {
        Row: ThreadMessage;
        Insert: Omit<ThreadMessage, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<ThreadMessage>;
      };
      thread_summaries: {
        Row: ThreadSummary;
        Insert: Omit<ThreadSummary, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<ThreadSummary>;
      };
      chat_sessions: {
        Row: ChatSession;
        Insert: Omit<ChatSession, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<ChatSession>;
      };
      chat_message_cache: {
        Row: ChatMessageCache;
        Insert: Omit<ChatMessageCache, 'id' | 'created_at'>;
        Update: Partial<ChatMessageCache>;
      };
      file_uploads: {
        Row: FileUpload;
        Insert: Omit<FileUpload, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<FileUpload>;
      };
      api_keys: {
        Row: ApiKey;
        Insert: Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<ApiKey>;
      };
      subscription_events: {
        Row: SubscriptionEvent;
        Insert: Omit<SubscriptionEvent, 'id' | 'processed_at'>;
        Update: Partial<SubscriptionEvent>;
      };
    };
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}