'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Star, Eye, ArrowRight, Sparkles, Code, Pen, BarChart3, Languages, Plus, Edit2, Trash2, X, Menu } from 'lucide-react'
import { useStore } from '@/store'
import { Button, Modal, Input } from './ui'
import type { PromptTemplate } from '@/types'

const categoryIcons: Record<string, React.ElementType> = {
  'Общие': Sparkles,
  'Разработка': Code,
  'Творчество': Pen,
  'Бизнес': BarChart3,
  'Языки': Languages,
}

export function PromptGallery() {
  const { 
    promptTemplates, favoriteTemplates, toggleFavorite, createChat, setCurrentChat,
    addPromptTemplate, updatePromptTemplate, deletePromptTemplate
  } = useStore()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<PromptTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Общие',
    tags: '',
    systemPrompt: ''
  })

  const categories = useMemo(() => {
    const cats = new Set(promptTemplates.map(t => t.category))
    return Array.from(cats)
  }, [promptTemplates])

  const filteredTemplates = useMemo(() => {
    return promptTemplates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
      const matchesCategory = !selectedCategory || t.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [promptTemplates, search, selectedCategory])

  const favoritesList = filteredTemplates.filter(t => favoriteTemplates.includes(t.id))
  const regularList = filteredTemplates.filter(t => !favoriteTemplates.includes(t.id))

  const handleUseTemplate = (templateId: string) => {
    const chatId = createChat(templateId)
    setCurrentChat(chatId)
  }

  const resetForm = () => {
    setFormData({ name: '', description: '', category: 'Общие', tags: '', systemPrompt: '' })
    setIsCreating(false)
    setEditingTemplate(null)
  }

  const handleSaveTemplate = () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) return
    
    const templateData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      category: formData.category,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      systemPrompt: formData.systemPrompt.trim(),
      isPublic: false,
      isFavorite: false,
      createdBy: 'user'
    }
    
    if (editingTemplate) {
      updatePromptTemplate(editingTemplate.id, templateData)
    } else {
      addPromptTemplate(templateData)
    }
    
    resetForm()
  }

  const handleEditTemplate = (template: PromptTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags.join(', '),
      systemPrompt: template.systemPrompt
    })
    setEditingTemplate(template)
    setIsCreating(true)
  }

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Удалить этот шаблон?')) {
      deletePromptTemplate(templateId)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          {/* Mobile menu button */}
          <button
            onClick={() => useStore.getState().toggleSidebar()}
            className="md:hidden p-2 -ml-2 mr-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-100 flex-1">Галерея промптов</h1>
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus size={16} />
            <span className="hidden sm:inline">Создать промпт</span>
          </Button>
        </div>
        <p className="text-zinc-400 mb-4 md:mb-6 text-sm md:text-base">Выберите шаблон для начала разговора</p>
        
        {/* Search & Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Поиск по названию или тегам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedCategory ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Все
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {favoritesList.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-zinc-500 uppercase mb-4 flex items-center gap-2">
              <Star size={14} className="text-yellow-500" />
              Избранные
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoritesList.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isFavorite={true}
                  onToggleFavorite={() => toggleFavorite(template.id)}
                  onPreview={() => setPreviewTemplate(template)}
                  onUse={() => handleUseTemplate(template.id)}
                  onEdit={() => handleEditTemplate(template)}
                  onDelete={() => handleDeleteTemplate(template.id)}
                  isUserCreated={template.createdBy === 'user'}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-zinc-500 uppercase mb-4">
            {selectedCategory || 'Все шаблоны'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularList.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                isFavorite={false}
                onToggleFavorite={() => toggleFavorite(template.id)}
                onPreview={() => setPreviewTemplate(template)}
                onUse={() => handleUseTemplate(template.id)}
                onEdit={() => handleEditTemplate(template)}
                onDelete={() => handleDeleteTemplate(template.id)}
                isUserCreated={template.createdBy === 'user'}
              />
            ))}
          </div>
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <Sparkles size={48} className="mx-auto mb-4 text-zinc-700" />
            <p className="text-zinc-500">Шаблоны не найдены</p>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title={previewTemplate?.name}
        size="lg"
      >
        {previewTemplate && (
          <div>
            <p className="text-zinc-400 mb-4">{previewTemplate.description}</p>
            <div className="bg-zinc-800 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-zinc-400 mb-2">Системный промпт:</h4>
              <p className="text-zinc-200 whitespace-pre-wrap">{previewTemplate.systemPrompt}</p>
            </div>
            <div className="flex gap-2 mb-4">
              {previewTemplate.tags.map(tag => (
                <span key={tag} className="px-2 py-1 text-xs bg-zinc-800 text-zinc-400 rounded">
                  {tag}
                </span>
              ))}
            </div>
            <Button onClick={() => { handleUseTemplate(previewTemplate.id); setPreviewTemplate(null) }} className="w-full gap-2">
              Использовать шаблон
              <ArrowRight size={18} />
            </Button>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreating}
        onClose={resetForm}
        title={editingTemplate ? 'Редактировать промпт' : 'Создать промпт'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Название"
            placeholder="Мой ассистент"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          />
          
          <Input
            label="Описание"
            placeholder="Краткое описание шаблона"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
          
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Категория</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
            >
              <option value="Общие">Общие</option>
              <option value="Разработка">Разработка</option>
              <option value="Творчество">Творчество</option>
              <option value="Бизнес">Бизнес</option>
              <option value="Языки">Языки</option>
            </select>
          </div>
          
          <Input
            label="Теги (через запятую)"
            placeholder="помощник, код, анализ"
            value={formData.tags}
            onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
          />
          
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Системный промпт</label>
            <textarea
              value={formData.systemPrompt}
              onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
              placeholder="Ты полезный ИИ-ассистент..."
              rows={6}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleSaveTemplate} 
              disabled={!formData.name.trim() || !formData.systemPrompt.trim()}
              className="flex-1"
            >
              {editingTemplate ? 'Сохранить' : 'Создать'}
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Отмена
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}


interface TemplateCardProps {
  template: PromptTemplate
  isFavorite: boolean
  onToggleFavorite: () => void
  onPreview: () => void
  onUse: () => void
  onEdit: () => void
  onDelete: () => void
  isUserCreated: boolean
}

function TemplateCard({ template, isFavorite, onToggleFavorite, onPreview, onUse, onEdit, onDelete, isUserCreated }: TemplateCardProps) {
  const Icon = categoryIcons[template.category] || Sparkles

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-lg bg-zinc-800">
          <Icon size={20} className="text-blue-400" />
        </div>
        <div className="flex items-center gap-1">
          {isUserCreated && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit() }}
                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
                title="Редактировать"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-red-400"
                title="Удалить"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Star
              size={18}
              className={isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-600'}
            />
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-zinc-100 mb-1">{template.name}</h3>
      <p className="text-sm text-zinc-500 mb-4 flex-1">{template.description}</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {template.tags.slice(0, 3).map(tag => (
          <span key={tag} className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-500 rounded">
            {tag}
          </span>
        ))}
        {isUserCreated && (
          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
            Мой
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onPreview} className="flex-1 gap-1">
          <Eye size={14} />
          Просмотр
        </Button>
        <Button size="sm" onClick={onUse} className="flex-1 gap-1">
          Начать
          <ArrowRight size={14} />
        </Button>
      </div>
    </motion.div>
  )
}
