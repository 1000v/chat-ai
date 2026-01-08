import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { 
  Chat, Message, Branch, PromptTemplate, UserSettings, MemoryItem, 
  ProfileSuggestion, Folder, UserMode, AIProvider, APIKey, EditResult 
} from '@/types'
import { generateId } from '@/lib/utils'

interface AppState {
  // User
  isOnboarded: boolean
  settings: UserSettings
  setOnboarded: (value: boolean) => void
  updateSettings: (settings: Partial<UserSettings>) => void
  
  // Chats
  chats: Chat[]
  currentChatId: string | null
  
  createChat: (promptTemplateId: string, title?: string) => string
  deleteChat: (chatId: string) => void
  setCurrentChat: (chatId: string | null) => void
  updateChat: (chatId: string, updates: Partial<Chat>) => void
  pinChat: (chatId: string) => void
  
  // Messages & Branches (Git-like)
  messages: Record<string, Message[]>
  branches: Record<string, Branch[]>
  
  addMessage: (chatId: string, branchId: string, message: Omit<Message, 'id' | 'createdAt' | 'branchId'>) => string
  updateMessageContent: (chatId: string, messageId: string, content: string) => void
  setMessageStreaming: (chatId: string, messageId: string, isStreaming: boolean) => void
  setMessageEditing: (chatId: string, messageId: string, isEditing: boolean) => void
  deleteMessage: (chatId: string, messageId: string) => void
  
  // Варианты ответов (как в DeepSeek/ChatGPT)
  addMessageVariant: (chatId: string, messageId: string, content: string) => number // returns variant index
  setActiveVariant: (chatId: string, messageId: string, variantIndex: number) => void
  
  // Edit message creates new branch
  editMessage: (chatId: string, messageId: string, newContent: string) => EditResult
  
  // Branch operations
  createBranch: (chatId: string, fromMessageId: string, name: string) => string
  switchBranch: (chatId: string, branchId: string) => void
  renameBranch: (chatId: string, branchId: string, newName: string) => void
  deleteBranch: (chatId: string, branchId: string) => void
  
  // Get messages for current branch
  getBranchMessages: (chatId: string, branchId: string) => Message[]
  
  // Prompt Templates
  promptTemplates: PromptTemplate[]
  favoriteTemplates: string[]
  toggleFavorite: (templateId: string) => void
  addPromptTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt'>) => string
  updatePromptTemplate: (templateId: string, updates: Partial<PromptTemplate>) => void
  deletePromptTemplate: (templateId: string) => void
  
  // AI Providers
  providers: AIProvider[]
  addProvider: (provider: Omit<AIProvider, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateProvider: (providerId: string, updates: Partial<AIProvider>) => void
  deleteProvider: (providerId: string) => void
  addApiKey: (providerId: string, key: string, label?: string) => void
  removeApiKey: (providerId: string, keyId: string) => void
  toggleApiKey: (providerId: string, keyId: string) => void
  reorderProviders: (providerIds: string[]) => void
  
  // Memory
  memoryItems: MemoryItem[]
  suggestions: ProfileSuggestion[]
  addMemoryItem: (item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateMemoryItem: (itemId: string, updates: Partial<MemoryItem>) => void
  deleteMemoryItem: (itemId: string) => void
  addSuggestion: (suggestion: Omit<ProfileSuggestion, 'id' | 'createdAt' | 'status'>) => void
  approveSuggestion: (suggestionId: string) => void
  rejectSuggestion: (suggestionId: string) => void
  
  // Analyzer
  lastAnalysisMessageCount: Record<string, number>
  isAnalyzing: boolean
  setAnalyzing: (value: boolean) => void
  updateLastAnalysis: (chatId: string, count: number) => void
  shouldAutoAnalyze: (chatId: string) => boolean
  
  // Folders
  folders: Folder[]
  createFolder: (name: string) => string
  deleteFolder: (folderId: string) => void
  moveToFolder: (chatId: string, folderId: string | undefined) => void
  
  // UI State
  sidebarOpen: boolean
  settingsOpen: boolean
  providersOpen: boolean
  profileOpen: boolean
  toggleSidebar: () => void
  toggleSettings: () => void
  toggleProviders: () => void
  toggleProfile: () => void
}


const defaultTemplates: PromptTemplate[] = [
  {
    id: 'default',
    name: 'Универсальный ассистент',
    description: 'Общий помощник для любых задач',
    category: 'Общие',
    tags: ['общий', 'помощник'],
    systemPrompt: 'Ты полезный ИИ-ассистент. Отвечай точно и по делу.',
    isPublic: true,
    isFavorite: false,
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    id: 'coder',
    name: 'Программист',
    description: 'Помощник для написания и отладки кода',
    category: 'Разработка',
    tags: ['код', 'программирование', 'разработка'],
    systemPrompt: 'Ты опытный программист. Помогай писать чистый, эффективный код с комментариями.',
    isPublic: true,
    isFavorite: false,
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    id: 'writer',
    name: 'Писатель',
    description: 'Помощник для написания текстов',
    category: 'Творчество',
    tags: ['текст', 'писательство', 'контент'],
    systemPrompt: 'Ты талантливый писатель. Помогай создавать качественные тексты.',
    isPublic: true,
    isFavorite: false,
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    id: 'analyst',
    name: 'Аналитик',
    description: 'Помощник для анализа данных',
    category: 'Бизнес',
    tags: ['анализ', 'данные', 'бизнес'],
    systemPrompt: 'Ты бизнес-аналитик. Помогай анализировать данные и принимать решения.',
    isPublic: true,
    isFavorite: false,
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    id: 'translator',
    name: 'Переводчик',
    description: 'Помощник для перевода текстов',
    category: 'Языки',
    tags: ['перевод', 'языки'],
    systemPrompt: 'Ты профессиональный переводчик. Переводи тексты точно, сохраняя стиль.',
    isPublic: true,
    isFavorite: false,
    createdBy: 'system',
    createdAt: new Date()
  }
]

const defaultProviders: AIProvider[] = [
  {
    id: 'ollama-default',
    name: 'Ollama (локальный)',
    baseUrl: 'http://localhost:11434',
    enabled: false,
    priority: 1,
    apiKeys: [],
    isOllama: true,
    isCodyApi: false,
    models: ['llama3', 'mistral', 'codellama', 'phi3'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
]


export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User
      isOnboarded: false,
      settings: {
        mode: 'standard' as UserMode,
        syncMemory: true,
        theme: 'dark',
        language: 'ru',
        analyzerInterval: 50,
        debugMode: false,
        fontFamily: 'system',
        fontSize: 14
      },
      setOnboarded: (value) => set({ isOnboarded: value }),
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      // Chats
      chats: [],
      currentChatId: null,
      messages: {},
      branches: {},
      
      createChat: (promptTemplateId, title) => {
        const chatId = generateId()
        const branchId = generateId()
        const template = get().promptTemplates.find(t => t.id === promptTemplateId)
        
        const mainBranch: Branch = {
          id: branchId,
          chatId,
          name: 'main',
          headCommitId: '',
          createdAt: new Date()
        }
        
        const newChat: Chat = {
          id: chatId,
          userId: 'user',
          title: title || template?.name || 'Новый чат',
          promptTemplateId,
          syncMemory: get().settings.syncMemory,
          mode: get().settings.mode,
          defaultBranchId: branchId,
          activeBranchId: branchId,
          isPinned: false,
          tags: [],
          messageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        
        set((state) => ({
          chats: [newChat, ...state.chats],
          currentChatId: chatId,
          messages: { ...state.messages, [chatId]: [] },
          branches: { ...state.branches, [chatId]: [mainBranch] }
        }))
        return chatId
      },
      
      deleteChat: (chatId) => set((state) => {
        const { [chatId]: _, ...restMessages } = state.messages
        const { [chatId]: __, ...restBranches } = state.branches
        return {
          chats: state.chats.filter(c => c.id !== chatId),
          messages: restMessages,
          branches: restBranches,
          currentChatId: state.currentChatId === chatId ? null : state.currentChatId
        }
      }),
      
      setCurrentChat: (chatId) => set({ currentChatId: chatId }),
      
      updateChat: (chatId, updates) => set((state) => ({
        chats: state.chats.map(c => c.id === chatId ? { ...c, ...updates, updatedAt: new Date() } : c)
      })),
      
      pinChat: (chatId) => set((state) => ({
        chats: state.chats.map(c => c.id === chatId ? { ...c, isPinned: !c.isPinned } : c)
      })),
      
      // Messages
      addMessage: (chatId, branchId, message) => {
        const id = generateId()
        const chatMessages = get().messages[chatId] || []
        const branchMessages = chatMessages.filter(m => m.branchId === branchId)
        const lastMessage = branchMessages[branchMessages.length - 1]
        
        const newMessage: Message = {
          ...message,
          id,
          branchId,
          parentMessageId: lastMessage?.id,
          createdAt: new Date()
        }
        
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: [...(state.messages[chatId] || []), newMessage]
          },
          chats: state.chats.map(c => c.id === chatId ? { 
            ...c, 
            messageCount: c.messageCount + 1, 
            updatedAt: new Date() 
          } : c),
          branches: {
            ...state.branches,
            [chatId]: state.branches[chatId]?.map(b => 
              b.id === branchId ? { ...b, headCommitId: id } : b
            ) || []
          }
        }))
        return id
      },
      
      updateMessageContent: (chatId, messageId, content) => set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId]?.map(m => 
            m.id === messageId ? { ...m, content } : m
          ) || []
        }
      })),
      
      setMessageStreaming: (chatId, messageId, isStreaming) => set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId]?.map(m => 
            m.id === messageId ? { ...m, isStreaming } : m
          ) || []
        }
      })),
      
      setMessageEditing: (chatId, messageId, isEditing) => set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId]?.map(m => 
            m.id === messageId ? { ...m, isEditing } : m
          ) || []
        }
      })),
      
      deleteMessage: (chatId, messageId) => set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId]?.filter(m => m.id !== messageId) || []
        },
        chats: state.chats.map(c => c.id === chatId ? { 
          ...c, 
          messageCount: Math.max(0, c.messageCount - 1),
          updatedAt: new Date() 
        } : c)
      })),
      
      // Варианты ответов (как в DeepSeek/ChatGPT)
      addMessageVariant: (chatId, messageId, content) => {
        const state = get()
        const message = state.messages[chatId]?.find(m => m.id === messageId)
        if (!message) return 0
        
        const variants = message.variants || []
        const newVariants = [...variants, content]
        const newIndex = newVariants.length // 0 = основной content, 1+ = варианты
        
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: state.messages[chatId]?.map(m => 
              m.id === messageId 
                ? { ...m, variants: newVariants, activeVariant: newIndex }
                : m
            ) || []
          }
        }))
        
        return newIndex
      },
      
      setActiveVariant: (chatId, messageId, variantIndex) => set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId]?.map(m => 
            m.id === messageId ? { ...m, activeVariant: variantIndex } : m
          ) || []
        }
      })),
      
      // Edit message - creates new branch from parent
      editMessage: (chatId, messageId, newContent) => {
        const state = get()
        const chatMessages = state.messages[chatId] || []
        const originalMessage = chatMessages.find(m => m.id === messageId)
        
        if (!originalMessage) {
          throw new Error('Message not found')
        }
        
        // Create new branch
        const newBranchId = generateId()
        const newMessageId = generateId()
        const branchCount = (state.branches[chatId] || []).length
        
        const newBranch: Branch = {
          id: newBranchId,
          chatId,
          name: `edit-${branchCount + 1}`,
          headCommitId: newMessageId,
          parentBranchId: originalMessage.branchId,
          forkFromCommitId: originalMessage.parentMessageId,
          createdAt: new Date()
        }
        
        // Create edited message on new branch
        const newMessage: Message = {
          id: newMessageId,
          role: originalMessage.role,
          content: newContent,
          branchId: newBranchId,
          parentMessageId: originalMessage.parentMessageId,
          createdAt: new Date(),
          metadata: {
            ...originalMessage.metadata,
            editedFrom: messageId
          }
        }
        
        set((state) => ({
          branches: {
            ...state.branches,
            [chatId]: [...(state.branches[chatId] || []), newBranch]
          },
          messages: {
            ...state.messages,
            [chatId]: [...(state.messages[chatId] || []), newMessage]
          },
          chats: state.chats.map(c => c.id === chatId ? {
            ...c,
            activeBranchId: newBranchId,
            updatedAt: new Date()
          } : c)
        }))
        
        return {
          newBranchId,
          newMessageId,
          originalBranchId: originalMessage.branchId
        }
      },
      
      // Branch operations
      createBranch: (chatId, fromMessageId, name) => {
        const id = generateId()
        const state = get()
        const message = state.messages[chatId]?.find(m => m.id === fromMessageId)
        
        const newBranch: Branch = {
          id,
          chatId,
          name,
          headCommitId: fromMessageId,
          parentBranchId: message?.branchId,
          forkFromCommitId: fromMessageId,
          createdAt: new Date()
        }
        
        set((state) => ({
          branches: {
            ...state.branches,
            [chatId]: [...(state.branches[chatId] || []), newBranch]
          }
        }))
        return id
      },
      
      switchBranch: (chatId, branchId) => set((state) => ({
        chats: state.chats.map(c => c.id === chatId ? { ...c, activeBranchId: branchId } : c)
      })),
      
      renameBranch: (chatId, branchId, newName) => set((state) => ({
        branches: {
          ...state.branches,
          [chatId]: state.branches[chatId]?.map(b => 
            b.id === branchId ? { ...b, name: newName } : b
          ) || []
        }
      })),
      
      deleteBranch: (chatId, branchId) => {
        const state = get()
        const chat = state.chats.find(c => c.id === chatId)
        
        // Can't delete default branch
        if (chat?.defaultBranchId === branchId) return
        
        set((state) => ({
          branches: {
            ...state.branches,
            [chatId]: state.branches[chatId]?.filter(b => b.id !== branchId) || []
          },
          // Switch to default branch if deleting active
          chats: state.chats.map(c => {
            if (c.id === chatId && c.activeBranchId === branchId) {
              return { ...c, activeBranchId: c.defaultBranchId }
            }
            return c
          })
        }))
      },
      
      // Get messages for a branch (including inherited from parent branches)
      getBranchMessages: (chatId, branchId) => {
        const state = get()
        const allMessages = state.messages[chatId] || []
        const branches = state.branches[chatId] || []
        const branch = branches.find(b => b.id === branchId)
        
        if (!branch) return []
        
        // Get messages directly on this branch
        const branchMessages = allMessages.filter(m => m.branchId === branchId)
        
        // If branch has a parent, get inherited messages up to fork point
        if (branch.parentBranchId && branch.forkFromCommitId) {
          const parentMessages = allMessages
            .filter(m => m.branchId === branch.parentBranchId)
            .filter(m => {
              // Include messages up to and including the fork point
              const forkMessage = allMessages.find(fm => fm.id === branch.forkFromCommitId)
              if (!forkMessage) return true
              return new Date(m.createdAt) <= new Date(forkMessage.createdAt)
            })
          
          return [...parentMessages, ...branchMessages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        }
        
        return branchMessages.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      },
      
      // Prompt Templates
      promptTemplates: defaultTemplates,
      favoriteTemplates: [],
      toggleFavorite: (templateId) => set((state) => ({
        favoriteTemplates: state.favoriteTemplates.includes(templateId)
          ? state.favoriteTemplates.filter(id => id !== templateId)
          : [...state.favoriteTemplates, templateId]
      })),
      
      addPromptTemplate: (template) => {
        const id = generateId()
        set((state) => ({
          promptTemplates: [...state.promptTemplates, { ...template, id, createdAt: new Date() }]
        }))
        return id
      },
      
      updatePromptTemplate: (templateId, updates) => set((state) => ({
        promptTemplates: state.promptTemplates.map(t => 
          t.id === templateId ? { ...t, ...updates } : t
        )
      })),
      
      deletePromptTemplate: (templateId) => set((state) => ({
        promptTemplates: state.promptTemplates.filter(t => t.id !== templateId || t.createdBy === 'system')
      })),
      
      // AI Providers
      providers: defaultProviders,
      
      addProvider: (provider) => {
        const id = generateId()
        const now = new Date()
        set((state) => ({
          providers: [...state.providers, { ...provider, id, createdAt: now, updatedAt: now }]
        }))
        return id
      },
      
      updateProvider: (providerId, updates) => set((state) => ({
        providers: state.providers.map(p => 
          p.id === providerId ? { ...p, ...updates, updatedAt: new Date() } : p
        )
      })),
      
      deleteProvider: (providerId) => set((state) => ({
        providers: state.providers.filter(p => p.id !== providerId)
      })),
      
      addApiKey: (providerId, key, label) => {
        const keyId = generateId()
        set((state) => ({
          providers: state.providers.map(p => {
            if (p.id !== providerId) return p
            if (p.apiKeys.length >= 5) return p // Max 5 keys
            return {
              ...p,
              apiKeys: [...p.apiKeys, { id: keyId, key, label, isValid: true, disabled: false, errorCount: 0 }],
              updatedAt: new Date()
            }
          })
        }))
      },
      
      removeApiKey: (providerId, keyId) => set((state) => ({
        providers: state.providers.map(p => {
          if (p.id !== providerId) return p
          return { ...p, apiKeys: p.apiKeys.filter(k => k.id !== keyId), updatedAt: new Date() }
        })
      })),
      
      toggleApiKey: (providerId, keyId) => set((state) => ({
        providers: state.providers.map(p => {
          if (p.id !== providerId) return p
          return {
            ...p,
            apiKeys: p.apiKeys.map(k => k.id === keyId ? { ...k, disabled: !k.disabled } : k),
            updatedAt: new Date()
          }
        })
      })),
      
      reorderProviders: (providerIds) => set((state) => ({
        providers: providerIds.map((id, index) => {
          const provider = state.providers.find(p => p.id === id)
          return provider ? { ...provider, priority: index + 1 } : null
        }).filter(Boolean) as AIProvider[]
      })),
      
      // Memory
      memoryItems: [],
      suggestions: [],
      addMemoryItem: (item) => {
        const id = generateId()
        const now = new Date()
        set((state) => ({
          memoryItems: [...state.memoryItems, { ...item, id, createdAt: now, updatedAt: now }]
        }))
      },
      updateMemoryItem: (itemId, updates) => set((state) => ({
        memoryItems: state.memoryItems.map(i => 
          i.id === itemId ? { ...i, ...updates, updatedAt: new Date() } : i
        )
      })),
      deleteMemoryItem: (itemId) => set((state) => ({
        memoryItems: state.memoryItems.filter(i => i.id !== itemId)
      })),
      addSuggestion: (suggestion) => {
        const id = generateId()
        set((state) => ({
          suggestions: [...state.suggestions, { ...suggestion, id, status: 'pending' as const, createdAt: new Date() }]
        }))
      },
      approveSuggestion: (suggestionId) => {
        const state = get()
        const suggestion = state.suggestions.find(s => s.id === suggestionId)
        if (suggestion) {
          // Add to memory when approved
          state.addMemoryItem({
            type: suggestion.type,
            text: suggestion.text,
            confidence: suggestion.confidence,
            tags: [],
            sourceRefs: [],
            scope: 'global'
          })
        }
        set((state) => ({
          suggestions: state.suggestions.map(s => s.id === suggestionId ? { ...s, status: 'approved' as const } : s)
        }))
      },
      rejectSuggestion: (suggestionId) => set((state) => ({
        suggestions: state.suggestions.map(s => s.id === suggestionId ? { ...s, status: 'rejected' as const } : s)
      })),
      
      // Analyzer
      lastAnalysisMessageCount: {},
      isAnalyzing: false,
      setAnalyzing: (value) => set({ isAnalyzing: value }),
      updateLastAnalysis: (chatId, count) => set((state) => ({
        lastAnalysisMessageCount: { ...state.lastAnalysisMessageCount, [chatId]: count }
      })),
      shouldAutoAnalyze: (chatId) => {
        const state = get()
        const chat = state.chats.find(c => c.id === chatId)
        if (!chat || state.settings.mode !== 'pro') return false
        
        const lastCount = state.lastAnalysisMessageCount[chatId] || 0
        const interval = state.settings.analyzerInterval || 50
        return chat.messageCount - lastCount >= interval
      },
      
      // Folders
      folders: [],
      createFolder: (name) => {
        const id = generateId()
        set((state) => ({
          folders: [...state.folders, { id, name, chatCount: 0 }]
        }))
        return id
      },
      deleteFolder: (folderId) => set((state) => ({
        folders: state.folders.filter(f => f.id !== folderId),
        chats: state.chats.map(c => c.folderId === folderId ? { ...c, folderId: undefined } : c)
      })),
      moveToFolder: (chatId, folderId) => set((state) => ({
        chats: state.chats.map(c => c.id === chatId ? { ...c, folderId } : c)
      })),
      
      // UI State
      sidebarOpen: true,
      settingsOpen: false,
      providersOpen: false,
      profileOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
      toggleProviders: () => set((state) => ({ providersOpen: !state.providersOpen })),
      toggleProfile: () => set((state) => ({ profileOpen: !state.profileOpen }))
    }),
    { name: 'ai-chat-store' }
  )
)
