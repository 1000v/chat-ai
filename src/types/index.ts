// Core Types for AI Chat Ecosystem

export type UserMode = 'simple' | 'standard' | 'pro'
export type MessageRole = 'user' | 'assistant' | 'system'
export type MemoryItemType = 'fact' | 'preference' | 'taboo' | 'goal' | 'interest'
export type ProfileScope = 'global' | 'chat'

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  createdAt: Date
  settings: UserSettings
}

export interface UserSettings {
  mode: UserMode
  syncMemory: boolean
  theme: 'light' | 'dark' | 'auto'
  language: string
  analyzerProviderId?: string
  analyzerModel?: string
  analyzerInterval: number // messages between analysis (25-100)
  debugMode: boolean // Show debug info in console and UI
  fontFamily: 'system' | 'inter' | 'roboto' | 'jetbrains' | 'fira'
  fontSize: number // 12-20px
}

export interface Chat {
  id: string
  userId: string
  title: string
  promptTemplateId: string
  syncMemory: boolean
  mode: UserMode
  defaultBranchId: string
  activeBranchId: string
  isPinned: boolean
  tags: string[]
  folderId?: string
  messageCount: number
  selectedProviderId?: string
  selectedModel?: string
  createdAt: Date
  updatedAt: Date
}

export interface Branch {
  id: string
  chatId: string
  name: string
  headCommitId: string
  parentBranchId?: string
  forkFromCommitId?: string
  createdAt: Date
}

export interface Commit {
  id: string
  chatId: string
  branchId: string
  parentCommitId?: string
  role: MessageRole
  content: string
  metadata: CommitMetadata
  createdAt: Date
}

export interface CommitMetadata {
  modelUsed?: string
  providerId?: string
  tokensIn?: number
  tokensOut?: number
  latencyMs?: number
  editedFrom?: string
  regeneratedFrom?: string
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  branchId: string
  parentMessageId?: string
  createdAt: Date
  isStreaming?: boolean
  isEditing?: boolean
  metadata?: CommitMetadata
  // Варианты ответа (для регенерации как в DeepSeek/ChatGPT)
  variants?: string[] // Альтернативные ответы
  activeVariant?: number // Индекс активного варианта (0 = основной content)
}

export interface PromptTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  systemPrompt: string
  isPublic: boolean
  isFavorite: boolean
  createdBy: string
  createdAt: Date
}

export interface MemoryItem {
  id: string
  type: MemoryItemType
  text: string
  confidence: number
  tags: string[]
  sourceRefs: string[]
  scope: ProfileScope
  chatId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Profile {
  id: string
  userId: string
  syncDefault: boolean
  items: MemoryItem[]
  updatedAt: Date
}

export interface ProfileSuggestion {
  id: string
  type: MemoryItemType
  text: string
  confidence: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
}

// Provider Types
export interface APIKey {
  id: string
  key: string
  label?: string
  isValid: boolean
  disabled: boolean
  lastUsed?: Date
  errorCount: number
}

export interface AIProvider {
  id: string
  name: string
  baseUrl: string
  enabled: boolean
  priority: number
  apiKeys: APIKey[]
  isOllama: boolean
  isCodyApi: boolean // CodyAPI mode - auto-detect endpoint by model prefix
  models: string[]
  modelPrefix?: string // For providers like BlackBox that need prefix (e.g., "blackboxai/")
  createdAt: Date
  updatedAt: Date
}

export interface Folder {
  id: string
  name: string
  color?: string
  chatCount: number
}

// Git-like operations
export interface EditResult {
  newBranchId: string
  newMessageId: string
  originalBranchId: string
}
