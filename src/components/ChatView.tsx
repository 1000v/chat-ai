'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Square, RefreshCw, Copy, Quote, Menu,
  ChevronDown, ChevronLeft, ChevronRight, Edit2, Check, X, Trash2, Bot, Brain, Sparkles
} from 'lucide-react'
import { useStore } from '@/store'
import { cn } from '@/lib/utils'
import { Button } from './ui'
import { MarkdownRenderer } from './MarkdownRenderer'
import type { Message } from '@/types'

// CodyAPI endpoint detection by model prefix
function getCodyApiEndpoint(model: string): string {
  if (model.startsWith('blackboxai/')) return 'blackbox'
  if (model.startsWith('pollinations/')) return 'pollinations_v1'
  return 'sentisum'
}

// Normalize base URL - remove trailing slash and endpoint paths for CodyAPI
function normalizeBaseUrl(url: string, isCodyApi: boolean): string {
  let normalized = url.replace(/\/+$/, '') // убираем trailing слэши
  if (isCodyApi) {
    // Убираем эндпоинты если они уже есть в URL
    normalized = normalized.replace(/\/(blackbox|pollinations_v1|sentisum)(\/.*)?$/, '')
  }
  return normalized
}

// Debug logger
function debugLog(debugMode: boolean, ...args: unknown[]) {
  if (debugMode) {
    console.log('[AI-Chat Debug]', ...args)
  }
}

// Build system prompt with memory
function buildSystemPrompt(
  basePrompt: string, 
  memoryItems: { type: string; text: string }[],
  syncMemory: boolean
): string {
  if (!syncMemory || memoryItems.length === 0) {
    return basePrompt
  }
  
  const memorySection = memoryItems
    .map(m => `- [${m.type}] ${m.text}`)
    .join('\n')
  
  return `${basePrompt}

<user_memory>
Информация о пользователе (используй для персонализации ответов):
${memorySection}
</user_memory>`
}

export function ChatView() {
  const {
    currentChatId, chats, branches, providers, settings,
    addMessage, updateMessageContent, setMessageStreaming, deleteMessage,
    getBranchMessages, promptTemplates, createBranch, switchBranch, updateChat,
    memoryItems, addSuggestion, addMemoryItem, isAnalyzing, setAnalyzing,
    updateLastAnalysis, shouldAutoAnalyze, toggleProfile, toggleSidebar,
    addMessageVariant, setActiveVariant
  } = useStore()
  
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string } | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const debug = settings.debugMode || false

  const currentChat = chats.find(c => c.id === currentChatId)
  const template = promptTemplates.find(t => t.id === currentChat?.promptTemplateId)
  
  const chatMessages = currentChatId && currentChat?.activeBranchId 
    ? getBranchMessages(currentChatId, currentChat.activeBranchId)
    : []

  // Get available models from enabled providers
  const enabledProviders = providers.filter(p => p.enabled)
  const availableModels = enabledProviders.flatMap(p => 
    p.models.map(m => ({ provider: p.name, providerId: p.id, model: m, isOllama: p.isOllama }))
  )
  
  const selectedModel = currentChat?.selectedModel || availableModels[0]?.model || 'demo'
  const selectedProvider = currentChat?.selectedProviderId 
    ? providers.find(p => p.id === currentChat.selectedProviderId)
    : enabledProviders[0]

  // Analyzer settings
  const analyzerProvider = settings.analyzerProviderId 
    ? providers.find(p => p.id === settings.analyzerProviderId)
    : null
  const canAnalyze = analyzerProvider && settings.analyzerModel && settings.mode !== 'simple'
  const showAnalyzeButton = settings.mode === 'standard' && canAnalyze

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Auto-analyze in Pro mode
  useEffect(() => {
    if (currentChatId && settings.mode === 'pro' && canAnalyze && !isAnalyzing && !isGenerating) {
      if (shouldAutoAnalyze(currentChatId)) {
        runAnalysis()
      }
    }
  }, [chatMessages.length, currentChatId, settings.mode])

  const runAnalysis = async () => {
    if (!currentChatId || !analyzerProvider || !settings.analyzerModel || isAnalyzing) return
    
    setAnalyzing(true)
    
    try {
      const activeKey = analyzerProvider.apiKeys.find(k => !k.disabled)
      if (!activeKey && !analyzerProvider.isOllama) {
        throw new Error('Нет активного API ключа для анализатора')
      }
      
      // Build analysis prompt
      const recentMessages = chatMessages.slice(-20) // Last 20 messages
      const conversationText = recentMessages
        .map(m => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`)
        .join('\n\n')
      
      const existingMemory = memoryItems
        .map(m => `[${m.type}] ${m.text}`)
        .join('\n')
      
      const analysisPrompt = `Проанализируй диалог и извлеки информацию о пользователе.

Существующая память:
${existingMemory || 'Пусто'}

Диалог:
${conversationText}

Найди новые факты, предпочтения, цели, интересы или табу пользователя.
Ответь в JSON формате:
{
  "suggestions": [
    {"type": "fact|preference|goal|interest|taboo", "text": "описание", "confidence": 0.0-1.0}
  ]
}

Только новая информация, которой нет в существующей памяти. Если ничего нового - пустой массив.`

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${analyzerProvider.baseUrl}/chat/completions`,
          method: 'POST',
          headers: activeKey ? { 'Authorization': `Bearer ${activeKey.key}` } : {},
          body: {
            model: settings.analyzerModel,
            messages: [{ role: 'user', content: analysisPrompt }],
            stream: false
          }
        })
      })
      
      const result = await response.json()
      
      if (result.ok && result.data?.choices?.[0]?.message?.content) {
        const content = result.data.choices[0].message.content
        // Try to parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            for (const s of parsed.suggestions) {
              if (s.type && s.text && s.confidence) {
                if (settings.mode === 'pro' && s.confidence >= 0.8) {
                  // Auto-add in Pro mode with high confidence
                  addMemoryItem({
                    type: s.type,
                    text: s.text,
                    confidence: s.confidence,
                    tags: [],
                    sourceRefs: [currentChatId],
                    scope: 'global'
                  })
                } else {
                  // Add as suggestion for review
                  addSuggestion({
                    type: s.type,
                    text: s.text,
                    confidence: s.confidence
                  })
                }
              }
            }
          }
        }
      }
      
      updateLastAnalysis(currentChatId, currentChat?.messageCount || 0)
    } catch (error) {
      console.error('Analysis error:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSelectModel = (providerId: string, model: string) => {
    if (currentChatId) {
      updateChat(currentChatId, { selectedProviderId: providerId, selectedModel: model })
    }
    setShowModelSelect(false)
  }

  const handleSend = async () => {
    if (!input.trim() || !currentChatId || !currentChat?.activeBranchId || isGenerating) return

    const userMessage = input.trim()
    setInput('')
    
    addMessage(currentChatId, currentChat.activeBranchId, { role: 'user', content: userMessage })
    
    setIsGenerating(true)
    const assistantId = addMessage(currentChatId, currentChat.activeBranchId, { 
      role: 'assistant', 
      content: '', 
      isStreaming: true 
    })
    
    // Check if we should use real API or demo
    const provider = selectedProvider
    const model = selectedModel
    
    if (model === 'demo' || !provider || provider.apiKeys.length === 0) {
      // Demo mode
      const response = generateDemoResponse(userMessage)
      let currentContent = ''
      for (const char of response) {
        await new Promise(r => setTimeout(r, 15))
        currentContent += char
        updateMessageContent(currentChatId, assistantId, currentContent)
      }
    } else {
      // Real API call with streaming
      try {
        const activeKey = provider.apiKeys.find(k => !k.disabled)
        if (!activeKey) throw new Error('Нет активного API ключа')
        
        // Build messages array with memory
        const basePrompt = template?.systemPrompt || 'You are a helpful assistant.'
        const systemPrompt = buildSystemPrompt(basePrompt, memoryItems, currentChat?.syncMemory ?? true)
        const apiMessages = [
          { role: 'system', content: systemPrompt },
          ...chatMessages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage }
        ]
        
        // Apply model prefix if provider has one (e.g., blackboxai/model-name)
        const apiModel = provider.modelPrefix ? `${provider.modelPrefix}${model}` : model
        
        // Determine API URL - CodyAPI mode auto-detects endpoint by model prefix
        const baseUrl = normalizeBaseUrl(provider.baseUrl, provider.isCodyApi)
        let apiUrl = `${baseUrl}/chat/completions`
        if (provider.isCodyApi) {
          const endpoint = getCodyApiEndpoint(model)
          apiUrl = `${baseUrl}/${endpoint}/chat/completions`
        }
        
        // Debug logging
        debugLog(debug, '=== API Request ===')
        debugLog(debug, 'URL:', apiUrl)
        debugLog(debug, 'Model:', apiModel)
        debugLog(debug, 'Provider:', provider.name, provider.isCodyApi ? '(CodyAPI)' : '')
        debugLog(debug, 'Messages count:', apiMessages.length)
        if (debug) setDebugInfo(`🔗 ${apiUrl}\n📦 Model: ${apiModel}\n💬 Messages: ${apiMessages.length}`)
        
        // Try streaming first
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: apiUrl,
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeKey.key}` },
            body: {
              model: apiModel,
              messages: apiMessages,
              stream: true
            },
            stream: true
          })
        })
        
        debugLog(debug, 'Response status:', response.status, response.statusText)
        
        if (response.ok && response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let currentContent = ''
          let chunkCount = 0
          let rawChunks: string[] = [] // для дебага
          let fullRaw = '' // собираем весь ответ
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value, { stream: true })
            fullRaw += chunk
            if (debug) rawChunks.push(chunk)
            debugLog(debug, 'Raw chunk:', chunk.slice(0, 200))
            
            const lines = chunk.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              debugLog(debug, 'Processing line:', line.slice(0, 100))
              
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  debugLog(debug, 'Stream completed, chunks received:', chunkCount)
                  continue
                }
                
                try {
                  const parsed = JSON.parse(data)
                  const delta = parsed.choices?.[0]?.delta?.content
                  if (delta) {
                    chunkCount++
                    currentContent += delta
                    updateMessageContent(currentChatId, assistantId, currentContent)
                  }
                } catch (parseError) {
                  debugLog(debug, 'JSON parse error:', data.slice(0, 100))
                }
              }
            }
          }
          
          debugLog(debug, 'Final content length:', currentContent.length)
          debugLog(debug, 'Total raw chunks:', rawChunks.length)
          
          // Если контента нет, попробуем распарсить как JSON ошибку
          if (!currentContent) {
            let errorMsg = 'Пустой ответ от API'
            try {
              const errorJson = JSON.parse(fullRaw)
              if (errorJson.error?.message) {
                errorMsg = errorJson.error.message
              } else if (errorJson.data?.error?.message) {
                errorMsg = errorJson.data.error.message
              }
            } catch {
              // Не JSON, показываем сырой ответ
            }
            const debugMsg = debug ? `\n\n📊 Debug: URL=${apiUrl}, Model=${apiModel}\nRaw: ${fullRaw.slice(0, 300)}` : ''
            updateMessageContent(currentChatId, assistantId, `❌ ${errorMsg}${debugMsg}`)
          }
        } else {
          // Fallback to non-streaming
          const result = await response.json()
          debugLog(debug, 'Non-streaming response:', result)
          
          if (result.ok && result.data?.choices?.[0]?.message?.content) {
            updateMessageContent(currentChatId, assistantId, result.data.choices[0].message.content)
          } else {
            const errorMsg = result.data?.error?.message || result.error || 'Ошибка API'
            const debugMsg = debug ? `\n\n📊 Debug: URL=${apiUrl}, Model=${apiModel}, Response=${JSON.stringify(result).slice(0, 200)}` : ''
            updateMessageContent(currentChatId, assistantId, `❌ Ошибка: ${errorMsg}${debugMsg}`)
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка'
        debugLog(debug, 'Request error:', error)
        updateMessageContent(currentChatId, assistantId, `❌ Ошибка: ${errorMsg}`)
      }
    }
    
    setMessageStreaming(currentChatId, assistantId, false)
    setIsGenerating(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStop = () => {
    setIsGenerating(false)
  }

  const handleRegenerate = async (messageId: string) => {
    if (!currentChatId || !currentChat?.activeBranchId || isGenerating) return
    
    const message = chatMessages.find(m => m.id === messageId)
    if (!message || message.role !== 'assistant') return
    
    setIsGenerating(true)
    setRegeneratingMessageId(messageId)
    
    // Добавляем новый вариант (пустой пока)
    const variantIndex = addMessageVariant(currentChatId, messageId, '')
    
    const messageIndex = chatMessages.findIndex(m => m.id === messageId)
    const prevMessages = chatMessages.slice(0, messageIndex)
    const prevUserMessage = prevMessages.reverse().find(m => m.role === 'user')
    
    const provider = selectedProvider
    const model = selectedModel
    
    // Функция для обновления текущего варианта
    const updateVariantContent = (content: string) => {
      const state = useStore.getState()
      const msg = state.messages[currentChatId]?.find(m => m.id === messageId)
      if (msg) {
        const variants = [...(msg.variants || [])]
        variants[variantIndex - 1] = content // variantIndex 1+ соответствует индексу в массиве
        useStore.setState({
          messages: {
            ...state.messages,
            [currentChatId]: state.messages[currentChatId]?.map(m => 
              m.id === messageId ? { ...m, variants, activeVariant: variantIndex } : m
            ) || []
          }
        })
      }
    }
    
    if (model === 'demo' || !provider || provider.apiKeys.length === 0) {
      // Demo mode
      const response = generateDemoResponse(prevUserMessage?.content || 'regenerate')
      let currentContent = ''
      for (const char of response) {
        await new Promise(r => setTimeout(r, 15))
        currentContent += char
        updateVariantContent(currentContent)
      }
    } else {
      // Real API call with streaming
      try {
        const activeKey = provider.apiKeys.find(k => !k.disabled)
        if (!activeKey) throw new Error('Нет активного API ключа')
        
        const basePrompt = template?.systemPrompt || 'You are a helpful assistant.'
        const systemPrompt = buildSystemPrompt(basePrompt, memoryItems, currentChat?.syncMemory ?? true)
        const apiMessages = [
          { role: 'system', content: systemPrompt },
          ...prevMessages.reverse().map(m => ({ role: m.role, content: m.content }))
        ]
        
        // Apply model prefix if provider has one
        const apiModel = provider.modelPrefix ? `${provider.modelPrefix}${model}` : model
        
        // Determine API URL - CodyAPI mode auto-detects endpoint by model prefix
        const baseUrl = normalizeBaseUrl(provider.baseUrl, provider.isCodyApi)
        let apiUrl = `${baseUrl}/chat/completions`
        if (provider.isCodyApi) {
          const endpoint = getCodyApiEndpoint(model)
          apiUrl = `${baseUrl}/${endpoint}/chat/completions`
        }
        
        // Debug logging
        debugLog(debug, '=== Regenerate Request ===')
        debugLog(debug, 'URL:', apiUrl)
        debugLog(debug, 'Model:', apiModel)
        debugLog(debug, 'Provider:', provider.name, provider.isCodyApi ? '(CodyAPI)' : '')
        debugLog(debug, 'Messages count:', apiMessages.length)
        if (debug) setDebugInfo(`🔄 Regenerate (вариант ${variantIndex})\n🔗 ${apiUrl}\n📦 Model: ${apiModel}`)
        
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: apiUrl,
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeKey.key}` },
            body: {
              model: apiModel,
              messages: apiMessages,
              stream: true
            },
            stream: true
          })
        })
        
        debugLog(debug, 'Response status:', response.status, response.statusText)
        
        if (response.ok && response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let currentContent = ''
          let chunkCount = 0
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  debugLog(debug, 'Stream completed, chunks received:', chunkCount)
                  continue
                }
                
                try {
                  const parsed = JSON.parse(data)
                  const delta = parsed.choices?.[0]?.delta?.content
                  if (delta) {
                    chunkCount++
                    currentContent += delta
                    updateVariantContent(currentContent)
                  }
                } catch (parseError) {
                  debugLog(debug, 'JSON parse error:', data.slice(0, 100))
                }
              }
            }
          }
          
          debugLog(debug, 'Final content length:', currentContent.length)
          
          if (!currentContent) {
            const debugMsg = debug ? `\n\n📊 Debug: URL=${apiUrl}, Model=${apiModel}, Status=${response.status}` : ''
            updateVariantContent(`❌ Пустой ответ от API${debugMsg}`)
          }
        } else {
          const result = await response.json()
          debugLog(debug, 'Non-streaming response:', result)
          
          if (result.ok && result.data?.choices?.[0]?.message?.content) {
            updateVariantContent(result.data.choices[0].message.content)
          } else {
            const errorMsg = result.data?.error?.message || result.error || 'Ошибка API'
            const debugMsg = debug ? `\n\n📊 Debug: URL=${apiUrl}, Model=${apiModel}, Response=${JSON.stringify(result).slice(0, 200)}` : ''
            updateVariantContent(`❌ Ошибка: ${errorMsg}${debugMsg}`)
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка'
        debugLog(debug, 'Request error:', error)
        updateVariantContent(`❌ Ошибка: ${errorMsg}`)
      }
    }
    
    setRegeneratingMessageId(null)
    setIsGenerating(false)
  }

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!currentChatId) return
    updateMessageContent(currentChatId, messageId, newContent)
  }

  // Редактирование сообщения пользователя с созданием форка (как в ChatGPT)
  const handleForkEdit = async (messageId: string, newContent: string) => {
    if (!currentChatId || !currentChat?.activeBranchId || isGenerating) return
    
    const message = chatMessages.find(m => m.id === messageId)
    if (!message || message.role !== 'user') return
    
    // Создаём новую ветку от родительского сообщения
    const branchName = `edit-${Date.now()}`
    const newBranchId = createBranch(currentChatId, message.parentMessageId || messageId, branchName)
    switchBranch(currentChatId, newBranchId)
    
    // Добавляем отредактированное сообщение пользователя
    addMessage(currentChatId, newBranchId, { role: 'user', content: newContent })
    
    // Генерируем ответ ИИ
    setIsGenerating(true)
    const assistantId = addMessage(currentChatId, newBranchId, { 
      role: 'assistant', 
      content: '', 
      isStreaming: true 
    })
    
    const provider = selectedProvider
    const model = selectedModel
    
    // Собираем историю до отредактированного сообщения + новое сообщение
    const messageIndex = chatMessages.findIndex(m => m.id === messageId)
    const prevMessages = chatMessages.slice(0, messageIndex)
    
    if (model === 'demo' || !provider || provider.apiKeys.length === 0) {
      const response = generateDemoResponse(newContent)
      let currentContent = ''
      for (const char of response) {
        await new Promise(r => setTimeout(r, 15))
        currentContent += char
        updateMessageContent(currentChatId, assistantId, currentContent)
      }
    } else {
      try {
        const activeKey = provider.apiKeys.find(k => !k.disabled)
        if (!activeKey) throw new Error('Нет активного API ключа')
        
        const basePrompt = template?.systemPrompt || 'You are a helpful assistant.'
        const systemPrompt = buildSystemPrompt(basePrompt, memoryItems, currentChat?.syncMemory ?? true)
        const apiMessages = [
          { role: 'system', content: systemPrompt },
          ...prevMessages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: newContent }
        ]
        
        const apiModel = provider.modelPrefix ? `${provider.modelPrefix}${model}` : model
        const baseUrl = normalizeBaseUrl(provider.baseUrl, provider.isCodyApi)
        let apiUrl = `${baseUrl}/chat/completions`
        if (provider.isCodyApi) {
          const endpoint = getCodyApiEndpoint(model)
          apiUrl = `${baseUrl}/${endpoint}/chat/completions`
        }
        
        debugLog(debug, '=== Fork Edit Request ===')
        debugLog(debug, 'URL:', apiUrl)
        debugLog(debug, 'Model:', apiModel)
        if (debug) setDebugInfo(`✏️ Fork Edit\n🔗 ${apiUrl}\n📦 Model: ${apiModel}`)
        
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: apiUrl,
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeKey.key}` },
            body: { model: apiModel, messages: apiMessages, stream: true },
            stream: true
          })
        })
        
        if (response.ok && response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let currentContent = ''
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  const delta = parsed.choices?.[0]?.delta?.content
                  if (delta) {
                    currentContent += delta
                    updateMessageContent(currentChatId, assistantId, currentContent)
                  }
                } catch {}
              }
            }
          }
          
          if (!currentContent) {
            updateMessageContent(currentChatId, assistantId, '❌ Пустой ответ от API')
          }
        } else {
          const result = await response.json()
          if (result.ok && result.data?.choices?.[0]?.message?.content) {
            updateMessageContent(currentChatId, assistantId, result.data.choices[0].message.content)
          } else {
            const errorMsg = result.data?.error?.message || result.error || 'Ошибка API'
            updateMessageContent(currentChatId, assistantId, `❌ Ошибка: ${errorMsg}`)
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка'
        updateMessageContent(currentChatId, assistantId, `❌ Ошибка: ${errorMsg}`)
      }
    }
    
    setMessageStreaming(currentChatId, assistantId, false)
    setIsGenerating(false)
  }

  const handleDeleteMessage = (messageId: string) => {
    if (!currentChatId) return
    if (confirm('Удалить это сообщение?')) {
      deleteMessage(currentChatId, messageId)
    }
  }

  if (!currentChat) return null

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 -ml-2 mr-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <Menu size={20} />
        </button>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-zinc-100 truncate">{currentChat.title}</h2>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{template?.name}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Analyze Button (Standard mode) */}
          {showAnalyzeButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={runAnalysis}
              disabled={isAnalyzing || chatMessages.length < 5}
              className="gap-1.5"
              title="Анализировать диалог"
            >
              <Brain size={14} className={isAnalyzing ? 'animate-pulse' : ''} />
              <span className="hidden sm:inline">
                {isAnalyzing ? 'Анализ...' : 'Анализ'}
              </span>
            </Button>
          )}
          
          {/* Pro mode indicator */}
          {settings.mode === 'pro' && canAnalyze && (
            <div 
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs cursor-pointer"
              onClick={toggleProfile}
              title="Авто-анализ активен"
            >
              <Sparkles size={12} />
              <span className="hidden sm:inline">Авто</span>
            </div>
          )}

          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelSelect(!showModelSelect)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors"
            >
              <Bot size={14} />
              <span className="max-w-[120px] truncate">{selectedModel}</span>
              <ChevronDown size={12} className={cn('transition-transform', showModelSelect && 'rotate-180')} />
            </button>
            
            <AnimatePresence>
              {showModelSelect && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-1 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[200px] max-h-[300px] overflow-y-auto"
                >
                  {availableModels.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-zinc-500">
                      Нет доступных моделей
                    </div>
                  ) : (
                    availableModels.map((m, i) => (
                      <button
                        key={`${m.providerId}-${m.model}-${i}`}
                        onClick={() => handleSelectModel(m.providerId, m.model)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-700',
                          selectedModel === m.model && 'bg-zinc-700'
                        )}
                      >
                        <div className="flex-1">
                          <p className="text-zinc-200">{m.model}</p>
                          <p className="text-xs text-zinc-500">{m.provider}</p>
                        </div>
                        {selectedModel === m.model && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))
                  )}
                  <div className="border-t border-zinc-700 mt-1 pt-1">
                    <button
                      onClick={() => handleSelectModel('', 'demo')}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-700',
                        selectedModel === 'demo' && 'bg-zinc-700'
                      )}
                    >
                      <div className="flex-1">
                        <p className="text-zinc-200">demo</p>
                        <p className="text-xs text-zinc-500">Демо режим</p>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-4 px-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-16">
                <Bot size={48} className="mx-auto mb-4 text-zinc-700" />
                <p className="text-zinc-500 mb-1">Начните разговор</p>
                <p className="text-sm text-zinc-600">Модель: {selectedModel}</p>
              </div>
            )}

            <div className="space-y-4">
              {chatMessages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLast={index === chatMessages.length - 1}
                  onEdit={handleEditMessage}
                  onForkEdit={handleForkEdit}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onRegenerate={() => handleRegenerate(message.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, messageId: message.id })
                  }}
                  isGenerating={isGenerating}
                  isRegenerating={regeneratingMessageId === message.id}
                  onSetVariant={(index) => currentChatId && setActiveVariant(currentChatId, message.id, index)}
                />
              ))}
            </div>
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3 bg-zinc-900/30">
        <div className="max-w-2xl mx-auto">
          {/* Debug Info Panel */}
          {debug && debugInfo && (
            <div className="mb-2 p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 font-mono whitespace-pre-wrap">
              <div className="flex items-center gap-1 mb-1 text-orange-400">
                <span>🐛 Debug Info</span>
                <button 
                  onClick={() => setDebugInfo('')}
                  className="ml-auto text-orange-500 hover:text-orange-300"
                >
                  ✕
                </button>
              </div>
              {debugInfo}
            </div>
          )}
          <div className="relative bg-zinc-900 rounded-xl border border-zinc-700 focus-within:border-zinc-600 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение..."
              rows={1}
              className="w-full px-4 py-3 pr-14 bg-transparent text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none text-sm"
            />
            <div className="absolute right-2 bottom-2">
              {isGenerating ? (
                <Button variant="danger" size="sm" onClick={handleStop}>
                  <Square size={14} />
                </Button>
              ) : (
                <Button size="sm" onClick={handleSend} disabled={!input.trim()}>
                  <Send size={14} />
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-600 mt-1.5 text-center">
            Enter — отправить • Shift+Enter — новая строка
            {debug && <span className="text-orange-500 ml-2">• Debug ON</span>}
          </p>
        </div>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            messageId={contextMenu.messageId}
            onClose={() => setContextMenu(null)}
            chatId={currentChatId!}
            onDelete={handleDeleteMessage}
            onQuote={(text) => {
              const quoted = `> ${text.split('\n').join('\n> ')}\n\n`
              setInput(prev => prev ? `${prev}\n${quoted}` : quoted)
              textareaRef.current?.focus()
            }}
            selectedText={window.getSelection()?.toString() || ''}
          />
        )}
      </AnimatePresence>
      
      {/* Click outside to close model select */}
      {showModelSelect && (
        <div className="fixed inset-0 z-10" onClick={() => setShowModelSelect(false)} />
      )}
    </div>
  )
}

function generateDemoResponse(userMessage: string): string {
  const responses = [
    `Это демо-ответ. Подключите провайдер в настройках для реальных ответов.\n\n**Ваш вопрос:** ${userMessage.slice(0, 100)}${userMessage.length > 100 ? '...' : ''}`,
    `Демо режим активен.\n\n\`\`\`typescript\nconst ai = new AIRouter();\nawait ai.chat(messages);\n\`\`\`\n\nНастройте провайдер для работы с ИИ.`,
    `Привет! Это демонстрация.\n\n1. Откройте **Провайдеры**\n2. Добавьте API ключ\n3. Выберите модель\n\nИ начните работу!`
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

// MessageBubble Component
interface MessageBubbleProps {
  message: Message
  isLast: boolean
  onEdit: (messageId: string, newContent: string) => void
  onForkEdit: (messageId: string, newContent: string) => void
  onDelete: () => void
  onRegenerate: () => void
  onContextMenu: (e: React.MouseEvent) => void
  isGenerating: boolean
  isRegenerating?: boolean
  onSetVariant: (index: number) => void
}

function MessageBubble({ 
  message, isLast, onEdit, onForkEdit, onDelete, onRegenerate, onContextMenu, isGenerating, isRegenerating, onSetVariant 
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  
  // Варианты: 0 = основной content, 1+ = variants[index-1]
  const variants = message.variants || []
  const totalVariants = 1 + variants.length // основной + варианты
  const activeVariant = message.activeVariant ?? 0
  
  // Получаем текущий контент в зависимости от активного варианта
  const displayContent = activeVariant === 0 
    ? message.content 
    : (variants[activeVariant - 1] ?? '')
  
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(displayContent)
  const [showActions, setShowActions] = useState(false)

  // Обновляем editContent при смене варианта
  useEffect(() => {
    if (!isEditing) {
      setEditContent(displayContent)
    }
  }, [displayContent, isEditing])

  const handleSaveEdit = () => {
    if (editContent.trim() !== displayContent) {
      if (isUser) {
        // Для сообщений пользователя - создаём форк (как в ChatGPT)
        onForkEdit(message.id, editContent.trim())
      } else {
        // Для сообщений ассистента - просто редактируем
        onEdit(message.id, editContent.trim())
      }

    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(displayContent)
    setIsEditing(false)
  }

  const canNavigateVariants = !isUser && totalVariants > 1 && !isRegenerating

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group',
        isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onContextMenu={onContextMenu}
    >
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3',
        isUser 
          ? 'bg-blue-600 text-white' 
          : 'bg-zinc-800 text-zinc-100'
      )}
      style={{ fontFamily: 'var(--chat-font-family)', fontSize: 'var(--chat-font-size)' }}
      >
        {isEditing ? (
          <div className="space-y-2 min-w-[300px]">
            <textarea
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value)
                // Auto-resize
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              ref={(el) => {
                if (el) {
                  // Set initial height based on content
                  el.style.height = 'auto'
                  el.style.height = `${Math.max(el.scrollHeight, 60)}px`
                }
              }}
              className={cn(
                "w-full min-h-[60px] max-h-[400px] rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500",
                isUser ? "bg-blue-700 text-white placeholder-blue-300" : "bg-zinc-900 text-zinc-100"
              )}
              style={{ fontFamily: 'var(--chat-font-family)', fontSize: 'var(--chat-font-size)' }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelEdit}
                className={cn(
                  "px-2 py-1 text-xs rounded",
                  isUser ? "bg-blue-700 hover:bg-blue-800 text-blue-100" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                )}
              >
                <X size={12} className="inline mr-1" />
                Отмена
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isGenerating}
                className={cn(
                  "px-2 py-1 text-xs rounded disabled:opacity-50",
                  isUser ? "bg-white text-blue-600 hover:bg-blue-50" : "bg-blue-600 hover:bg-blue-500 text-white"
                )}
              >
                <Check size={12} className="inline mr-1" />
                {isUser ? 'Отправить' : 'Сохранить'}
              </button>
            </div>
            {isUser && (
              <p className="text-xs text-blue-200 opacity-70">
                Будет создана новая ветка диалога
              </p>
            )}
          </div>
        ) : (
          <>
            {(message.isStreaming || isRegenerating) ? (
              displayContent ? (
                // Рендерим markdown на лету во время стриминга
                <div className="streaming-content">
                  <MarkdownRenderer content={displayContent} />
                  <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-1 align-middle" />
                </div>
              ) : (
                // Анимация "Думаю..." с точками
                <ThinkingAnimation />
              )
            ) : (
              <MarkdownRenderer content={displayContent} />
            )}
          </>
        )}
      </div>

      {/* Variant Navigation - DeepSeek style */}
      {canNavigateVariants && !isEditing && (
        <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
          <button
            onClick={() => onSetVariant(Math.max(0, activeVariant - 1))}
            disabled={activeVariant === 0}
            className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[40px] text-center">
            {activeVariant + 1} / {totalVariants}
          </span>
          <button
            onClick={() => onSetVariant(Math.min(totalVariants - 1, activeVariant + 1))}
            disabled={activeVariant === totalVariants - 1}
            className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Action buttons - fixed height to prevent jumping */}
      <div className="h-8 mt-1">
        <AnimatePresence>
          {showActions && !isEditing && !message.isStreaming && !isRegenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-700"
            >
              <ActionButton 
                icon={Edit2} 
                title={isUser ? "Редактировать (создаст новую ветку)" : "Редактировать"} 
                onClick={() => setIsEditing(true)} 
                disabled={isGenerating}
              />
              <ActionButton icon={Copy} title="Копировать" onClick={() => navigator.clipboard.writeText(displayContent)} />
              {!isUser && (
                <ActionButton 
                  icon={RefreshCw} 
                  title="Перегенерировать (добавить вариант)" 
                  onClick={onRegenerate}
                  disabled={isGenerating}
                />
              )}
              <ActionButton icon={Trash2} title="Удалить" onClick={onDelete} className="text-red-400 hover:text-red-300" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ActionButton Component
interface ActionButtonProps {
  icon: React.ElementType
  title: string
  onClick: () => void
  disabled?: boolean
  className?: string
}

function ActionButton({ icon: Icon, title, onClick, disabled, className }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50',
        className
      )}
    >
      <Icon size={14} />
    </button>
  )
}

// ThinkingAnimation Component - анимация "Думаю..." с точками
function ThinkingAnimation() {
  return (
    <div className="flex items-center gap-1.5 text-sm text-zinc-400">
      <span>Думаю</span>
      <span className="flex gap-1 items-end pb-0.5">
        <span className="thinking-dot w-1.5 h-1.5 bg-zinc-400 rounded-full" />
        <span className="thinking-dot w-1.5 h-1.5 bg-zinc-400 rounded-full" />
        <span className="thinking-dot w-1.5 h-1.5 bg-zinc-400 rounded-full" />
      </span>
    </div>
  )
}

// ContextMenu Component
interface ContextMenuProps {
  x: number
  y: number
  messageId: string
  onClose: () => void
  chatId: string
  onDelete: (messageId: string) => void
  onQuote: (text: string) => void
  selectedText: string
}

function ContextMenu({ x, y, messageId, onClose, chatId, onDelete, onQuote, selectedText }: ContextMenuProps) {
  const { messages } = useStore()
  const message = messages[chatId]?.find(m => m.id === messageId)

  useEffect(() => {
    const handleClick = () => onClose()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [onClose])

  if (!message) return null

  // Получаем текущий контент с учётом вариантов
  const variants = message.variants || []
  const activeVariant = message.activeVariant ?? 0
  const displayContent = activeVariant === 0 
    ? message.content 
    : (variants[activeVariant - 1] ?? message.content)

  // Для цитаты используем выделенный текст, если есть
  const textToQuote = selectedText.trim() || displayContent

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => navigator.clipboard.writeText(selectedText || displayContent)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
      >
        <Copy size={14} />
        {selectedText ? 'Копировать выделенное' : 'Копировать'}
      </button>
      <button
        onClick={() => {
          onQuote(textToQuote)
          onClose()
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
      >
        <Quote size={14} />
        {selectedText ? 'Цитировать выделенное' : 'Цитировать всё'}
      </button>
      <div className="border-t border-zinc-700 my-1" />
      <button
        onClick={() => onDelete(messageId)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700"
      >
        <Trash2 size={14} />
        Удалить
      </button>
    </motion.div>
  )
}
