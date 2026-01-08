'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key, Plus, Trash2, Eye, EyeOff, Check, X, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, GripVertical, Server, Edit2, Loader2
} from 'lucide-react'
import { Button, Input, Modal, Toggle } from './ui'
import { useStore } from '@/store'
import { cn } from '@/lib/utils'
import type { AIProvider } from '@/types'

export function ProvidersPanel() {
  const { 
    providersOpen, toggleProviders, providers, 
    addProvider, updateProvider, deleteProvider,
    addApiKey, removeApiKey, toggleApiKey, reorderProviders
  } = useStore()
  
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [newKeyInput, setNewKeyInput] = useState<Record<string, { key: string; label: string }>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { status: 'success' | 'error'; message?: string } | null>>({})
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({}) // Доступные модели с API
  
  // New provider form
  const [isAddingProvider, setIsAddingProvider] = useState(false)
  const [newProvider, setNewProvider] = useState({
    name: '',
    baseUrl: '',
    isOllama: false,
    isCodyApi: false,
    modelPrefix: ''
  })
  const [editingProvider, setEditingProvider] = useState<string | null>(null)

  const handleAddProvider = () => {
    if (!newProvider.name.trim() || !newProvider.baseUrl.trim()) return
    
    addProvider({
      name: newProvider.name.trim(),
      baseUrl: newProvider.baseUrl.trim(),
      enabled: true,
      priority: providers.length + 1,
      apiKeys: [],
      isOllama: newProvider.isOllama,
      isCodyApi: newProvider.isCodyApi,
      models: newProvider.isOllama ? ['llama3', 'mistral', 'codellama'] : [],
      modelPrefix: newProvider.modelPrefix.trim() || undefined
    })
    
    setNewProvider({ name: '', baseUrl: '', isOllama: false, isCodyApi: false, modelPrefix: '' })
    setIsAddingProvider(false)
  }

  const handleAddApiKey = (providerId: string) => {
    const input = newKeyInput[providerId]
    if (!input?.key.trim()) return
    
    const provider = providers.find(p => p.id === providerId)
    if (provider && provider.apiKeys.length >= 5) {
      alert('Максимум 5 ключей на провайдер')
      return
    }
    
    addApiKey(providerId, input.key.trim(), input.label.trim() || undefined)
    setNewKeyInput(prev => ({ ...prev, [providerId]: { key: '', label: '' } }))
  }

  const testConnection = async (providerId: string) => {
    setTesting(providerId)
    setTestResult(prev => ({ ...prev, [providerId]: null }))
    
    // Get fresh provider data from store
    const currentProviders = useStore.getState().providers
    const provider = currentProviders.find(p => p.id === providerId)
    if (!provider) return
    
    try {
      // Test connection based on provider type
      const testUrl = provider.isOllama 
        ? `${provider.baseUrl}/api/tags`
        : `${provider.baseUrl}/models`
      
      const headers: Record<string, string> = {}
      
      // Add API key for non-Ollama providers
      if (!provider.isOllama && provider.apiKeys.length > 0) {
        const activeKey = provider.apiKeys.find(k => !k.disabled)
        if (activeKey) {
          headers['Authorization'] = `Bearer ${activeKey.key}`
        }
      }
      
      // Use proxy to avoid CORS issues
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: testUrl,
          method: 'GET',
          headers
        })
      })
      
      const result = await response.json()
      
      if (result.ok) {
        // Сохраняем доступные модели для выбора (НЕ добавляем автоматически)
        let loadedModels: string[] = []
        const data = result.data
        
        if (provider.isOllama && data?.models) {
          // Ollama format
          loadedModels = data.models.map((m: { name: string }) => m.name)
        } else if (data?.data && Array.isArray(data.data)) {
          // OpenAI format: { data: [{ id: "gpt-4", ... }] }
          loadedModels = data.data.map((m: { id: string }) => m.id).filter(Boolean)
        }
        
        // Сохраняем в состояние для отображения
        setAvailableModels(prev => ({ ...prev, [providerId]: loadedModels }))
        
        setTestResult(prev => ({ 
          ...prev, 
          [providerId]: { 
            status: 'success', 
            message: loadedModels.length > 0 
              ? `Подключение успешно! Найдено ${loadedModels.length} моделей — выберите нужные ниже` 
              : 'Подключение успешно! Добавьте модели вручную'
          } 
        }))
      } else {
        const errorText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data || result.error || '')
        setTestResult(prev => ({ 
          ...prev, 
          [providerId]: { 
            status: 'error', 
            message: `Ошибка ${result.status || ''}: ${result.statusText || ''}${errorText ? ` - ${errorText.slice(0, 100)}` : ''}` 
          } 
        }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      setTestResult(prev => ({ 
        ...prev, 
        [providerId]: { 
          status: 'error', 
          message: errorMessage.includes('timeout') 
            ? 'Таймаут подключения (10 сек)' 
            : errorMessage.includes('fetch') 
              ? 'Не удалось подключиться к серверу' 
              : errorMessage 
        } 
      }))
    } finally {
      setTesting(null)
    }
  }

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••'
    return key.slice(0, 4) + '••••••••' + key.slice(-4)
  }

  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority)

  return (
    <Modal isOpen={providersOpen} onClose={toggleProviders} title="AI Провайдеры" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-zinc-500 mb-4">
          Добавьте свои AI-провайдеры. Можно использовать любой OpenAI-совместимый API или Ollama.
          Максимум 5 API ключей на провайдер для ротации.
        </p>

        {/* Add Provider Button */}
        {!isAddingProvider ? (
          <Button onClick={() => setIsAddingProvider(true)} className="w-full gap-2">
            <Plus size={16} />
            Добавить провайдер
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-zinc-800 rounded-xl p-4 space-y-4"
          >
            <h3 className="font-medium text-zinc-200">Новый провайдер</h3>
            
            <Input
              label="Название"
              placeholder="Например: OpenAI, Groq, Together AI..."
              value={newProvider.name}
              onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
            />
            
            <Input
              label="Base URL"
              placeholder="https://api.example.com/v1"
              value={newProvider.baseUrl}
              onChange={(e) => setNewProvider(prev => ({ ...prev, baseUrl: e.target.value }))}
            />
            
            <div className="flex items-center gap-3">
              <Toggle
                checked={newProvider.isOllama}
                onChange={(checked) => setNewProvider(prev => ({ ...prev, isOllama: checked, isCodyApi: false }))}
                label="Это Ollama"
                description="Ollama не требует API ключей"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <Toggle
                checked={newProvider.isCodyApi}
                onChange={(checked) => setNewProvider(prev => ({ ...prev, isCodyApi: checked, isOllama: false }))}
                label="CodyAPI режим"
                description="Авто-эндпоинт по префиксу модели (blackboxai/, pollinations/)"
              />
            </div>
            
            {!newProvider.isCodyApi && (
              <>
                <Input
                  label="Префикс модели (опционально)"
                  placeholder="blackboxai/ или openrouter/"
                  value={newProvider.modelPrefix}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, modelPrefix: e.target.value }))}
                />
                <p className="text-xs text-zinc-600 -mt-2">
                  Для провайдеров типа BlackBox/OpenRouter, где модель отправляется как prefix/model-name
                </p>
              </>
            )}
            
            <div className="flex gap-2">
              <Button onClick={handleAddProvider} disabled={!newProvider.name || !newProvider.baseUrl}>
                Добавить
              </Button>
              <Button variant="ghost" onClick={() => setIsAddingProvider(false)}>
                Отмена
              </Button>
            </div>
          </motion.div>
        )}

        {/* Providers List */}
        <div className="space-y-3">
          {sortedProviders.map((provider, index) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              index={index}
              isExpanded={expandedProvider === provider.id}
              onToggleExpand={() => setExpandedProvider(
                expandedProvider === provider.id ? null : provider.id
              )}
              onToggleEnabled={() => updateProvider(provider.id, { enabled: !provider.enabled })}
              onDelete={() => deleteProvider(provider.id)}
              onUpdate={(updates) => updateProvider(provider.id, updates)}
              newKeyInput={newKeyInput[provider.id] || { key: '', label: '' }}
              onNewKeyInputChange={(input) => setNewKeyInput(prev => ({ 
                ...prev, 
                [provider.id]: input 
              }))}
              onAddKey={() => handleAddApiKey(provider.id)}
              onRemoveKey={(keyId) => removeApiKey(provider.id, keyId)}
              onToggleKey={(keyId) => toggleApiKey(provider.id, keyId)}
              showKeys={showKeys}
              onToggleShowKey={(keyId) => setShowKeys(prev => ({ 
                ...prev, 
                [keyId]: !prev[keyId] 
              }))}
              testing={testing === provider.id}
              testResult={testResult[provider.id]}
              onTest={() => testConnection(provider.id)}
              maskKey={maskKey}
              isEditing={editingProvider === provider.id}
              onToggleEdit={() => setEditingProvider(
                editingProvider === provider.id ? null : provider.id
              )}
              availableModels={availableModels[provider.id] || []}
            />
          ))}
        </div>

        {providers.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            <Server size={32} className="mx-auto mb-2 opacity-50" />
            <p>Нет провайдеров</p>
            <p className="text-sm">Добавьте первый провайдер для начала работы</p>
          </div>
        )}
      </div>
    </Modal>
  )
}


interface ProviderCardProps {
  provider: AIProvider
  index: number
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleEnabled: () => void
  onDelete: () => void
  onUpdate: (updates: Partial<AIProvider>) => void
  newKeyInput: { key: string; label: string }
  onNewKeyInputChange: (input: { key: string; label: string }) => void
  onAddKey: () => void
  onRemoveKey: (keyId: string) => void
  onToggleKey: (keyId: string) => void
  showKeys: Record<string, boolean>
  onToggleShowKey: (keyId: string) => void
  testing: boolean
  testResult: { status: 'success' | 'error'; message?: string } | null
  onTest: () => void
  maskKey: (key: string) => string
  isEditing: boolean
  onToggleEdit: () => void
  availableModels: string[] // Доступные модели с API для выбора
}

function ProviderCard({
  provider, index, isExpanded, onToggleExpand, onToggleEnabled, onDelete, onUpdate,
  newKeyInput, onNewKeyInputChange, onAddKey, onRemoveKey, onToggleKey,
  showKeys, onToggleShowKey, testing, testResult, onTest, maskKey,
  isEditing, onToggleEdit, availableModels
}: ProviderCardProps) {
  const [editName, setEditName] = useState(provider.name)
  const [editUrl, setEditUrl] = useState(provider.baseUrl)
  const [editPrefix, setEditPrefix] = useState(provider.modelPrefix || '')
  const [editIsCodyApi, setEditIsCodyApi] = useState(provider.isCodyApi || false)
  const [newModel, setNewModel] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [editModelValue, setEditModelValue] = useState('')
  const [availableFilter, setAvailableFilter] = useState('')
  const [selectedAvailable, setSelectedAvailable] = useState<Set<string>>(new Set())

  const handleSaveEdit = () => {
    onUpdate({ 
      name: editName, 
      baseUrl: editUrl, 
      modelPrefix: editIsCodyApi ? undefined : (editPrefix.trim() || undefined),
      isCodyApi: editIsCodyApi
    })
    onToggleEdit()
  }

  const handleAddModel = () => {
    if (!newModel.trim()) return
    // Support comma-separated models
    const modelsToAdd = newModel.split(',').map(m => m.trim()).filter(Boolean)
    const existingModels = new Set(provider.models)
    const newModels = modelsToAdd.filter(m => !existingModels.has(m))
    
    if (newModels.length === 0) {
      alert('Все модели уже добавлены')
      return
    }
    
    onUpdate({ models: [...provider.models, ...newModels] })
    setNewModel('')
  }

  const handleRemoveModel = (model: string) => {
    onUpdate({ models: provider.models.filter(m => m !== model) })
  }

  const handleStartEditModel = (model: string) => {
    setEditingModel(model)
    setEditModelValue(model)
  }

  const handleSaveModelEdit = () => {
    if (!editingModel || !editModelValue.trim()) return
    if (editModelValue.trim() === editingModel) {
      setEditingModel(null)
      return
    }
    // Replace model in array
    const newModels = provider.models.map(m => 
      m === editingModel ? editModelValue.trim() : m
    )
    onUpdate({ models: newModels })
    setEditingModel(null)
  }

  const handleCancelModelEdit = () => {
    setEditingModel(null)
    setEditModelValue('')
  }

  // Filter models
  const filteredModels = provider.models.filter(m => 
    m.toLowerCase().includes(modelFilter.toLowerCase())
  )

  const handleClearFiltered = () => {
    if (modelFilter) {
      // Remove only filtered models
      onUpdate({ models: provider.models.filter(m => !m.toLowerCase().includes(modelFilter.toLowerCase())) })
    } else {
      // Remove all
      onUpdate({ models: [] })
    }
  }

  // Фильтруем доступные модели (исключаем уже добавленные)
  const notAddedModels = availableModels.filter(m => !provider.models.includes(m))
  const filteredAvailable = notAddedModels.filter(m => 
    m.toLowerCase().includes(availableFilter.toLowerCase())
  )

  const handleToggleAvailable = (model: string) => {
    setSelectedAvailable(prev => {
      const next = new Set(prev)
      if (next.has(model)) {
        next.delete(model)
      } else {
        next.add(model)
      }
      return next
    })
  }

  const handleAddSelected = () => {
    if (selectedAvailable.size === 0) return
    onUpdate({ models: [...provider.models, ...Array.from(selectedAvailable)] })
    setSelectedAvailable(new Set())
  }

  const handleAddAllFiltered = () => {
    if (filteredAvailable.length === 0) return
    onUpdate({ models: [...provider.models, ...filteredAvailable] })
    setSelectedAvailable(new Set())
  }

  return (
    <motion.div
      layout
      className={cn(
        'bg-zinc-800/50 rounded-xl border overflow-hidden transition-colors',
        provider.enabled ? 'border-zinc-700' : 'border-zinc-800 opacity-60'
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-zinc-800/80 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2 text-zinc-500">
          <GripVertical size={16} />
          <span className="text-xs font-mono w-6">#{provider.priority}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {provider.isOllama && (
              <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                Ollama
              </span>
            )}
            {provider.isCodyApi && (
              <span className="px-1.5 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded">
                CodyAPI
              </span>
            )}
            <h3 className="font-medium text-zinc-200 truncate">{provider.name}</h3>
            {provider.apiKeys.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                {provider.apiKeys.filter(k => !k.disabled).length}/{provider.apiKeys.length} ключей
              </span>
            )}
            {testResult?.status === 'success' && (
              <Check size={16} className="text-green-500" />
            )}
            {testResult?.status === 'error' && (
              <AlertCircle size={16} className="text-red-500" />
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate">{provider.baseUrl}</p>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <Toggle
            checked={provider.enabled}
            onChange={() => onToggleEnabled()}
          />
        </div>

        {isExpanded ? (
          <ChevronUp size={18} className="text-zinc-500" />
        ) : (
          <ChevronDown size={18} className="text-zinc-500" />
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-700"
          >
            <div className="p-4 space-y-4">
              {/* Edit Mode */}
              {isEditing ? (
                <div className="space-y-3 p-3 bg-zinc-900 rounded-lg">
                  <Input
                    label="Название"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Input
                    label="Base URL"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                  />
                  <Toggle
                    checked={editIsCodyApi}
                    onChange={setEditIsCodyApi}
                    label="CodyAPI режим"
                    description="Авто-эндпоинт по префиксу модели"
                  />
                  {!editIsCodyApi && (
                    <Input
                      label="Префикс модели"
                      placeholder="blackboxai/ или openrouter/"
                      value={editPrefix}
                      onChange={(e) => setEditPrefix(e.target.value)}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>Сохранить</Button>
                    <Button size="sm" variant="ghost" onClick={onToggleEdit}>Отмена</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={onToggleEdit} className="gap-1">
                    <Edit2 size={14} />
                    Редактировать
                  </Button>
                  <Button size="sm" variant="danger" onClick={onDelete} className="gap-1">
                    <Trash2 size={14} />
                    Удалить
                  </Button>
                </div>
              )}

              {/* API Keys (not for Ollama) */}
              {!provider.isOllama && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-zinc-400">
                      API Ключи ({provider.apiKeys.length}/5)
                    </label>
                  </div>
                  
                  {/* Existing Keys */}
                  {provider.apiKeys.map((apiKey) => (
                    <div
                      key={apiKey.id}
                      className={cn(
                        'flex items-center gap-2 p-2 bg-zinc-900 rounded-lg',
                        apiKey.disabled && 'opacity-50'
                      )}
                    >
                      <Key size={14} className="text-zinc-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {apiKey.label && (
                          <p className="text-xs text-zinc-500">{apiKey.label}</p>
                        )}
                        <span className="font-mono text-sm text-zinc-300">
                          {showKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                        </span>
                      </div>
                      <button
                        onClick={() => onToggleShowKey(apiKey.id)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
                      >
                        {showKeys[apiKey.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => onToggleKey(apiKey.id)}
                        className={cn(
                          'p-1 rounded hover:bg-zinc-800',
                          apiKey.disabled ? 'text-yellow-500' : 'text-green-500'
                        )}
                        title={apiKey.disabled ? 'Включить' : 'Отключить'}
                      >
                        {apiKey.disabled ? <X size={14} /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => onRemoveKey(apiKey.id)}
                        className="p-1 rounded hover:bg-zinc-800 text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {/* Add New Key */}
                  {provider.apiKeys.length < 5 && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Метка (опционально)"
                          value={newKeyInput.label}
                          onChange={(e) => onNewKeyInputChange({ ...newKeyInput, label: e.target.value })}
                          className="w-32"
                        />
                        <Input
                          type="password"
                          placeholder="sk-..."
                          value={newKeyInput.key}
                          onChange={(e) => onNewKeyInputChange({ ...newKeyInput, key: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={onAddKey}
                          disabled={!newKeyInput.key.trim()}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Models - Manual Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400">
                    Модели ({filteredModels.length}{modelFilter ? `/${provider.models.length}` : ''})
                  </label>
                  {provider.models.length > 0 && (
                    <button
                      onClick={handleClearFiltered}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      {modelFilter ? `Удалить ${filteredModels.length} найденных` : 'Очистить все'}
                    </button>
                  )}
                </div>
                
                {/* Filter */}
                {provider.models.length > 5 && (
                  <Input
                    placeholder="Фильтр моделей..."
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    className="text-sm"
                  />
                )}
                
                {/* Existing Models */}
                {filteredModels.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto space-y-1 p-2 bg-zinc-900 rounded-lg">
                    {filteredModels.map(model => (
                      <div 
                        key={model} 
                        className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 group"
                      >
                        {editingModel === model ? (
                          // Режим редактирования
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editModelValue}
                              onChange={(e) => setEditModelValue(e.target.value)}
                              className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveModelEdit()
                                if (e.key === 'Escape') handleCancelModelEdit()
                              }}
                            />
                            <button
                              onClick={handleSaveModelEdit}
                              className="p-1 rounded hover:bg-zinc-600 text-green-400"
                              title="Сохранить"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={handleCancelModelEdit}
                              className="p-1 rounded hover:bg-zinc-600 text-zinc-400"
                              title="Отмена"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          // Обычный режим
                          <>
                            <span 
                              className="truncate cursor-pointer hover:text-blue-400"
                              onClick={() => handleStartEditModel(model)}
                              title="Клик для редактирования"
                            >
                              {model}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEditModel(model)}
                                className="p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Редактировать"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleRemoveModel(model)}
                                className="p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-red-400"
                                title="Удалить модель"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {modelFilter && filteredModels.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-2">
                    Модели не найдены
                  </p>
                )}
                
                {/* Add New Model */}
                <div className="flex gap-2">
                  <Input
                    placeholder="gpt-4, claude-3, gemini-pro (через запятую)"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddModel()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddModel}
                    disabled={!newModel.trim()}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
                
                {provider.isOllama && (
                  <p className="text-xs text-zinc-600">
                    Для Ollama модели загружаются автоматически при проверке подключения
                  </p>
                )}
              </div>

              {/* Available Models from API */}
              {notAddedModels.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-zinc-400">
                      📦 Доступные модели ({filteredAvailable.length}/{notAddedModels.length})
                    </label>
                    <div className="flex gap-2">
                      {selectedAvailable.size > 0 && (
                        <button
                          onClick={handleAddSelected}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Добавить выбранные ({selectedAvailable.size})
                        </button>
                      )}
                      <button
                        onClick={handleAddAllFiltered}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        Добавить все {availableFilter ? 'найденные' : ''}
                      </button>
                    </div>
                  </div>
                  
                  {/* Filter available */}
                  {notAddedModels.length > 5 && (
                    <Input
                      placeholder="Поиск доступных моделей..."
                      value={availableFilter}
                      onChange={(e) => setAvailableFilter(e.target.value)}
                      className="text-sm"
                    />
                  )}
                  
                  {/* Available models list */}
                  <div className="max-h-[250px] overflow-y-auto space-y-1 p-2 bg-zinc-900/50 rounded-lg border border-zinc-700">
                    {filteredAvailable.map(model => (
                      <div 
                        key={model}
                        onClick={() => handleToggleAvailable(model)}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer transition-colors',
                          selectedAvailable.has(model)
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                          selectedAvailable.has(model)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-zinc-600'
                        )}>
                          {selectedAvailable.has(model) && <Check size={12} className="text-white" />}
                        </div>
                        <span className="truncate">{model}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdate({ models: [...provider.models, model] })
                          }}
                          className="ml-auto p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-green-400"
                          title="Добавить"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ))}
                    {filteredAvailable.length === 0 && availableFilter && (
                      <p className="text-xs text-zinc-500 text-center py-2">
                        Модели не найдены
                      </p>
                    )}
                  </div>
                  
                  <p className="text-xs text-zinc-600">
                    Кликните на модель для выбора или нажмите + для быстрого добавления
                  </p>
                </div>
              )}

              {/* Test Connection */}
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onTest}
                  disabled={(!provider.isOllama && provider.apiKeys.length === 0) || testing}
                  className="gap-2"
                >
                  {testing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Проверить подключение
                </Button>
                
                {/* Test Result Message */}
                {testResult && (
                  <div className={cn(
                    'p-2 rounded-lg text-sm',
                    testResult.status === 'success' 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  )}>
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
