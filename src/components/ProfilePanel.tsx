'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Brain, Target, Heart, AlertTriangle, Lightbulb,
  Plus, Trash2, Edit2, Download, Upload, X, Check, Search, Play, Save
} from 'lucide-react'
import { useStore } from '@/store'
import { Button, Input, Modal } from './ui'
import type { MemoryItem, MemoryItemType, ProfileSuggestion } from '@/types'
import { cn, formatDate } from '@/lib/utils'

const typeConfig: Record<MemoryItemType, { icon: React.ElementType; label: string; color: string }> = {
  fact: { icon: Brain, label: 'Факт', color: 'text-blue-400' },
  preference: { icon: Heart, label: 'Предпочтение', color: 'text-pink-400' },
  taboo: { icon: AlertTriangle, label: 'Табу', color: 'text-red-400' },
  goal: { icon: Target, label: 'Цель', color: 'text-green-400' },
  interest: { icon: Lightbulb, label: 'Интерес', color: 'text-yellow-400' }
}

interface ProfilePanelProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const { 
    memoryItems, suggestions, addMemoryItem, updateMemoryItem, deleteMemoryItem, 
    approveSuggestion, rejectSuggestion, settings, providers, currentChatId,
    chats, getBranchMessages, isAnalyzing, setAnalyzing, updateLastAnalysis, addSuggestion
  } = useStore()
  const [activeTab, setActiveTab] = useState<'memory' | 'suggestions'>('memory')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<MemoryItemType | 'all'>('all')
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null)
  const [newItem, setNewItem] = useState({ type: 'fact' as MemoryItemType, text: '' })

  const filteredItems = memoryItems.filter(item => {
    const matchesSearch = item.text.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' || item.type === filterType
    return matchesSearch && matchesType
  })

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')

  const handleAddItem = () => {
    if (newItem.text.trim()) {
      addMemoryItem({
        type: newItem.type,
        text: newItem.text.trim(),
        confidence: 1,
        tags: [],
        sourceRefs: [],
        scope: 'global'
      })
      setNewItem({ type: 'fact', text: '' })
      setIsAddingItem(false)
    }
  }

  const handleEditItem = (item: MemoryItem) => {
    setEditingItem(item)
    setNewItem({ type: item.type, text: item.text })
    setIsAddingItem(true)
  }

  const handleSaveEdit = () => {
    if (editingItem && newItem.text.trim()) {
      updateMemoryItem(editingItem.id, { 
        type: newItem.type, 
        text: newItem.text.trim() 
      })
      setEditingItem(null)
      setNewItem({ type: 'fact', text: '' })
      setIsAddingItem(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingItem(null)
    setNewItem({ type: 'fact', text: '' })
    setIsAddingItem(false)
  }

  // Manual analysis function
  const runManualAnalysis = async () => {
    const analyzerProvider = settings.analyzerProviderId 
      ? providers.find(p => p.id === settings.analyzerProviderId)
      : null
    
    if (!analyzerProvider || !settings.analyzerModel || !currentChatId) return
    
    const currentChat = chats.find(c => c.id === currentChatId)
    if (!currentChat) return
    
    const chatMessages = getBranchMessages(currentChatId, currentChat.activeBranchId)
    if (chatMessages.length < 3) return
    
    setAnalyzing(true)
    
    try {
      const activeKey = analyzerProvider.apiKeys.find(k => !k.disabled)
      if (!activeKey && !analyzerProvider.isOllama) {
        throw new Error('Нет активного API ключа')
      }
      
      const recentMessages = chatMessages.slice(-20)
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
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            for (const s of parsed.suggestions) {
              if (s.type && s.text && s.confidence) {
                addSuggestion({
                  type: s.type,
                  text: s.text,
                  confidence: s.confidence
                })
              }
            }
            // Switch to suggestions tab if we got new ones
            if (parsed.suggestions.length > 0) {
              setActiveTab('suggestions')
            }
          }
        }
      }
      
      updateLastAnalysis(currentChatId, currentChat.messageCount)
    } catch (error) {
      console.error('Analysis error:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const canAnalyze = settings.analyzerProviderId && settings.analyzerModel && currentChatId

  const handleExport = () => {
    const data = JSON.stringify(memoryItems, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'profile-memory.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Профиль и память" size="xl">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-800 pb-4">
          <button
            onClick={() => setActiveTab('memory')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'memory' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <Brain size={16} className="inline mr-2" />
            Память ({memoryItems.length})
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors relative',
              activeTab === 'suggestions' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <Lightbulb size={16} className="inline mr-2" />
            Предложения
            {pendingSuggestions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                {pendingSuggestions.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'memory' && (
          <>
            {/* Search & Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as MemoryItemType | 'all')}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Все типы</option>
                {Object.entries(typeConfig).map(([type, config]) => (
                  <option key={type} value={type}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => { setEditingItem(null); setIsAddingItem(true) }} className="gap-1">
                <Plus size={14} />
                Добавить
              </Button>
              <Button size="sm" variant="secondary" onClick={handleExport} className="gap-1">
                <Download size={14} />
                Экспорт
              </Button>
              {canAnalyze && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={runManualAnalysis} 
                  disabled={isAnalyzing}
                  className="gap-1"
                >
                  <Play size={14} className={isAnalyzing ? 'animate-spin' : ''} />
                  {isAnalyzing ? 'Анализ...' : 'Анализировать'}
                </Button>
              )}
            </div>

            {/* Add/Edit Item Form */}
            <AnimatePresence>
              {isAddingItem && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-zinc-800 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-300">
                      {editingItem ? 'Редактировать запись' : 'Новая запись'}
                    </span>
                  </div>
                  <select
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value as MemoryItemType })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                  >
                    {Object.entries(typeConfig).map(([type, config]) => (
                      <option key={type} value={type}>{config.label}</option>
                    ))}
                  </select>
                  <textarea
                    value={newItem.text}
                    onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
                    placeholder="Введите текст..."
                    rows={3}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={editingItem ? handleSaveEdit : handleAddItem} className="gap-1">
                      <Save size={14} />
                      {editingItem ? 'Сохранить' : 'Добавить'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Отмена</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Memory Items */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Brain size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Память пуста</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <MemoryItemCard 
                    key={item.id} 
                    item={item} 
                    onDelete={() => deleteMemoryItem(item.id)}
                    onEdit={() => handleEditItem(item)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'suggestions' && (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {pendingSuggestions.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <Lightbulb size={32} className="mx-auto mb-2 opacity-50" />
                <p>Нет новых предложений</p>
              </div>
            ) : (
              pendingSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApprove={() => approveSuggestion(suggestion.id)}
                  onReject={() => rejectSuggestion(suggestion.id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}


function MemoryItemCard({ item, onDelete, onEdit }: { item: MemoryItem; onDelete: () => void; onEdit: () => void }) {
  const config = typeConfig[item.type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
    >
      <div className={cn('p-2 rounded-lg bg-zinc-900', config.color)}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
          <span className="text-xs text-zinc-600">{formatDate(item.createdAt)}</span>
          {item.confidence < 1 && (
            <span className="text-xs text-zinc-600">
              ({Math.round(item.confidence * 100)}%)
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-300">{item.text}</p>
        {item.tags.length > 0 && (
          <div className="flex gap-1 mt-2">
            {item.tags.map(tag => (
              <span key={tag} className="px-1.5 py-0.5 text-xs bg-zinc-900 text-zinc-500 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-zinc-900"
          title="Редактировать"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900"
          title="Удалить"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

function SuggestionCard({ suggestion, onApprove, onReject }: { 
  suggestion: ProfileSuggestion
  onApprove: () => void
  onReject: () => void 
}) {
  const config = typeConfig[suggestion.type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700"
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg bg-zinc-900', config.color)}>
          <Icon size={16} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
            <span className="text-xs text-zinc-600">
              Уверенность: {Math.round(suggestion.confidence * 100)}%
            </span>
          </div>
          <p className="text-sm text-zinc-300 mb-3">{suggestion.text}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={onApprove} className="gap-1">
              <Check size={14} />
              Принять
            </Button>
            <Button size="sm" variant="ghost" onClick={onReject} className="gap-1">
              <X size={14} />
              Отклонить
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
