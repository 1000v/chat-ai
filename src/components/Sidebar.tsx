'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Pin, MoreHorizontal, Trash2, X,
  Settings, MessageSquare, Sparkles, Server, Brain, PanelLeftClose, PanelLeft
} from 'lucide-react'
import { useStore } from '@/store'
import { cn, formatDate } from '@/lib/utils'
import { Button } from './ui'

const SIDEBAR_WIDTH = 280
const SIDEBAR_COLLAPSED_WIDTH = 56

export function Sidebar() {
  const {
    chats, currentChatId, setCurrentChat, deleteChat, pinChat,
    sidebarOpen, toggleSidebar, toggleSettings, toggleProviders, toggleProfile
  } = useStore()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Определяем мобильное устройство
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Закрываем сайдбар при выборе чата на мобильном
  const handleSelectChat = (chatId: string) => {
    setCurrentChat(chatId)
    if (isMobile && sidebarOpen) toggleSidebar()
  }

  const handleNewChat = () => {
    setCurrentChat(null)
    if (isMobile && sidebarOpen) toggleSidebar()
  }

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(search.toLowerCase())
  )

  const pinnedChats = filteredChats.filter(c => c.isPinned)
  const regularChats = filteredChats.filter(c => !c.isPinned)

  // Мобильная версия - выезжает поверх с оверлеем
  if (isMobile) {
    return (
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Затемнение */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
              className="fixed inset-0 bg-black/50 z-40"
            />
            
            {/* Сайдбар */}
            <motion.aside
              initial={{ x: -SIDEBAR_WIDTH }}
              animate={{ x: 0 }}
              exit={{ x: -SIDEBAR_WIDTH }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-zinc-900 border-r border-zinc-800 flex flex-col z-50"
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-blue-500" size={22} />
                    <span className="font-bold text-lg text-zinc-100">AI Chat</span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <Button
                  variant="primary"
                  className="w-full gap-2"
                  onClick={handleNewChat}
                >
                  <Plus size={18} />
                  Новый чат
                </Button>
              </div>

              {/* Search */}
              <div className="p-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Поиск чатов..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Chat List */}
              <div className="flex-1 overflow-y-auto px-2">
                <ChatList
                  pinnedChats={pinnedChats}
                  regularChats={regularChats}
                  filteredChats={filteredChats}
                  currentChatId={currentChatId}
                  onSelect={handleSelectChat}
                  onDelete={deleteChat}
                  onPin={pinChat}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                />
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-zinc-800 space-y-1">
                <SidebarButton icon={Brain} label="Память" onClick={() => { toggleProfile(); toggleSidebar() }} collapsed={false} />
                <SidebarButton icon={Server} label="Провайдеры" onClick={() => { toggleProviders(); toggleSidebar() }} collapsed={false} />
                <SidebarButton icon={Settings} label="Настройки" onClick={() => { toggleSettings(); toggleSidebar() }} collapsed={false} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    )
  }

  // Десктопная версия - сворачивается в полоску
  return (
    <motion.aside
      initial={false}
      animate={{ 
        width: sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH 
      }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <motion.div 
            className="flex items-center gap-2 overflow-hidden"
            animate={{ opacity: sidebarOpen ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <Sparkles className="text-blue-500 shrink-0" size={22} />
            {sidebarOpen && (
              <span className="font-bold text-lg text-zinc-100 whitespace-nowrap">AI Chat</span>
            )}
          </motion.div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
            title={sidebarOpen ? 'Свернуть' : 'Развернуть'}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
        </div>
        
        {sidebarOpen ? (
          <Button
            variant="primary"
            className="w-full gap-2"
            onClick={handleNewChat}
          >
            <Plus size={18} />
            Новый чат
          </Button>
        ) : (
          <button
            onClick={handleNewChat}
            className="w-full p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex justify-center"
            title="Новый чат"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* Search - только в развёрнутом */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Поиск чатов..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2">
        {sidebarOpen ? (
          <ChatList
            pinnedChats={pinnedChats}
            regularChats={regularChats}
            filteredChats={filteredChats}
            currentChatId={currentChatId}
            onSelect={handleSelectChat}
            onDelete={deleteChat}
            onPin={pinChat}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
          />
        ) : (
          // Свёрнутый вид - только иконки
          <div className="space-y-1 py-2">
            {chats.slice(0, 12).map(chat => (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={cn(
                  "w-full p-2 rounded-lg transition-colors flex justify-center",
                  chat.id === currentChatId 
                    ? "bg-zinc-800 text-zinc-100" 
                    : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                )}
                title={chat.title}
              >
                <MessageSquare size={18} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={cn(
        "border-t border-zinc-800",
        sidebarOpen ? "p-3 space-y-1" : "p-2 space-y-1"
      )}>
        <SidebarButton icon={Brain} label="Память" onClick={toggleProfile} collapsed={!sidebarOpen} />
        <SidebarButton icon={Server} label="Провайдеры" onClick={toggleProviders} collapsed={!sidebarOpen} />
        <SidebarButton icon={Settings} label="Настройки" onClick={toggleSettings} collapsed={!sidebarOpen} />
      </div>
    </motion.aside>
  )
}

type ChatType = {
  id: string
  title: string
  isPinned: boolean
  messageCount: number
  updatedAt: Date
}

function ChatList({ 
  pinnedChats, regularChats, filteredChats, currentChatId, 
  onSelect, onDelete, onPin, menuOpen, setMenuOpen 
}: { 
  pinnedChats: ChatType[]
  regularChats: ChatType[]
  filteredChats: ChatType[]
  currentChatId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onPin: (id: string) => void
  menuOpen: string | null
  setMenuOpen: (id: string | null) => void
}) {
  return (
    <>
      {pinnedChats.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-500 uppercase">
            <Pin size={12} />
            Закреплённые
          </div>
          {pinnedChats.map(chat => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === currentChatId}
              onSelect={() => onSelect(chat.id)}
              onDelete={() => onDelete(chat.id)}
              onPin={() => onPin(chat.id)}
              menuOpen={menuOpen === chat.id}
              setMenuOpen={setMenuOpen}
            />
          ))}
        </div>
      )}

      {regularChats.length > 0 && (
        <div>
          <div className="px-2 py-1 text-xs text-zinc-500 uppercase">
            Чаты
          </div>
          {regularChats.map(chat => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === currentChatId}
              onSelect={() => onSelect(chat.id)}
              onDelete={() => onDelete(chat.id)}
              onPin={() => onPin(chat.id)}
              menuOpen={menuOpen === chat.id}
              setMenuOpen={setMenuOpen}
            />
          ))}
        </div>
      )}

      {filteredChats.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Нет чатов</p>
        </div>
      )}
    </>
  )
}

// Кнопка в футере сайдбара
interface SidebarButtonProps {
  icon: React.ElementType
  label: string
  onClick: () => void
  collapsed: boolean
}

function SidebarButton({ icon: Icon, label, onClick, collapsed }: SidebarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors",
        collapsed ? "p-2 justify-center" : "gap-3 px-3 py-2"
      )}
      title={label}
    >
      <Icon size={18} />
      {!collapsed && <span className="text-sm">{label}</span>}
    </button>
  )
}

interface ChatItemProps {
  chat: ChatType
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onPin: () => void
  menuOpen: boolean
  setMenuOpen: (id: string | null) => void
}

function ChatItem({ chat, isActive, onSelect, onDelete, onPin, menuOpen, setMenuOpen }: ChatItemProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
      )}
      onClick={onSelect}
    >
      <MessageSquare size={16} className="text-zinc-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 truncate">{chat.title}</p>
        <p className="text-xs text-zinc-500">{formatDate(chat.updatedAt)}</p>
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen(menuOpen ? null : chat.id)
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 transition-all"
      >
        <MoreHorizontal size={16} className="text-zinc-400" />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-full mt-1 z-10 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { onPin(); setMenuOpen(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
            >
              <Pin size={14} />
              {chat.isPinned ? 'Открепить' : 'Закрепить'}
            </button>
            <button
              onClick={() => { onDelete(); setMenuOpen(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700"
            >
              <Trash2 size={14} />
              Удалить
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
