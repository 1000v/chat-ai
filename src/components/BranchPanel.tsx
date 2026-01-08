'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Plus, Check, X, Edit2, Trash2, CornerDownRight } from 'lucide-react'
import { useStore } from '@/store'
import { cn, formatDate } from '@/lib/utils'
import { Button, Input } from './ui'

interface BranchPanelProps {
  chatId: string
  onClose: () => void
}

export function BranchPanel({ chatId, onClose }: BranchPanelProps) {
  const { 
    chats, branches,
    switchBranch, createBranch, renameBranch, deleteBranch, getBranchMessages
  } = useStore()
  
  const chat = chats.find(c => c.id === chatId)
  const chatBranches = branches[chatId] || []
  const [isCreating, setIsCreating] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [editingBranch, setEditingBranch] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleCreateBranch = () => {
    if (newBranchName.trim()) {
      const currentBranch = chatBranches.find(b => b.id === chat?.activeBranchId)
      const branchId = createBranch(chatId, currentBranch?.headCommitId || '', newBranchName.trim())
      switchBranch(chatId, branchId)
      setNewBranchName('')
      setIsCreating(false)
    }
  }

  const handleStartRename = (branchId: string, currentName: string) => {
    setEditingBranch(branchId)
    setEditName(currentName)
  }

  const handleSaveRename = (branchId: string) => {
    if (editName.trim()) {
      renameBranch(chatId, branchId, editName.trim())
    }
    setEditingBranch(null)
  }

  const handleDelete = (branchId: string) => {
    if (branchId === chat?.defaultBranchId) {
      alert('Нельзя удалить основную ветку')
      return
    }
    if (confirm('Удалить эту ветку?')) {
      deleteBranch(chatId, branchId)
    }
  }

  const sortedBranches = [...chatBranches].sort((a, b) => {
    if (a.id === chat?.defaultBranchId) return -1
    if (b.id === chat?.defaultBranchId) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 300, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      className="h-full bg-zinc-900 border-l border-zinc-800 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
          <GitBranch size={18} />
          Ветки ({chatBranches.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedBranches.map((branch) => {
          const isActive = branch.id === chat?.activeBranchId
          const isDefault = branch.id === chat?.defaultBranchId
          const branchMessages = getBranchMessages(chatId, branch.id)
          const messageCount = branchMessages.length
          
          return (
            <div key={branch.id}>
              {editingBranch === branch.id ? (
                <div className="p-2 bg-zinc-800 rounded-lg">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mb-2"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(branch.id)
                      if (e.key === 'Escape') setEditingBranch(null)
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveRename(branch.id)}>
                      <Check size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingBranch(null)}>
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => switchBranch(chatId, branch.id)}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors group cursor-pointer',
                    isActive
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'hover:bg-zinc-800'
                  )}
                >
                  <div className="mt-0.5">
                    {branch.parentBranchId ? (
                      <CornerDownRight size={16} className={cn(
                        isActive ? 'text-blue-400' : 'text-zinc-600'
                      )} />
                    ) : (
                      <GitBranch size={16} className={cn(
                        isActive ? 'text-blue-400' : 'text-zinc-500'
                      )} />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        'text-sm truncate font-medium',
                        isActive ? 'text-blue-400' : 'text-zinc-300'
                      )}>
                        {branch.name}
                      </p>
                      {isDefault && (
                        <span className="px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-400 rounded">
                          main
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {messageCount} сообщ. • {formatDate(branch.createdAt)}
                    </p>
                  </div>

                  {isActive && <Check size={16} className="text-blue-400 mt-0.5" />}

                  {/* Actions - using div instead of button */}
                  <div 
                    className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      onClick={() => handleStartRename(branch.id, branch.name)}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      <Edit2 size={12} />
                    </div>
                    {!isDefault && (
                      <div
                        onClick={() => handleDelete(branch.id)}
                        className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Create New Branch */}
        {isCreating ? (
          <div className="mt-2 p-3 bg-zinc-800 rounded-lg">
            <Input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="Название ветки"
              className="mb-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateBranch()
                if (e.key === 'Escape') setIsCreating(false)
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateBranch} className="flex-1">
                Создать
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 mt-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span className="text-sm">Новая ветка</span>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-600 space-y-1">
          <p>• Создавайте ветки для разных направлений</p>
          <p>• Переключайтесь между ветками</p>
          <p>• Каждая ветка хранит свою историю</p>
        </div>
      </div>
    </motion.div>
  )
}
