'use client'

import { useEffect } from 'react'
import { useStore } from '@/store'
import { Onboarding, Sidebar, PromptGallery, ChatView, Settings, ProvidersPanel, ProfilePanel } from '@/components'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AnimatePresence } from 'framer-motion'

// Font family mapping
const fontFamilies: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", sans-serif',
  roboto: '"Roboto", sans-serif',
  jetbrains: '"JetBrains Mono", monospace',
  fira: '"Fira Code", monospace'
}

const fontSizes: Record<string, string> = {
  small: '13px',
  medium: '14px',
  large: '16px'
}

export default function Home() {
  const { 
    isOnboarded, currentChatId, sidebarOpen, toggleSidebar,
    providersOpen, profileOpen, toggleProfile, settings
  } = useStore()

  // Apply font settings
  useEffect(() => {
    const fontFamily = fontFamilies[settings.fontFamily || 'system']
    const fontSize = `${settings.fontSize || 14}px`
    document.documentElement.style.setProperty('--chat-font-family', fontFamily)
    document.documentElement.style.setProperty('--chat-font-size', fontSize)
  }, [settings.fontFamily, settings.fontSize])

  // Show onboarding for new users
  if (!isOnboarded) {
    return (
      <ThemeProvider>
        <Onboarding />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <div className="h-screen flex overflow-hidden">
        {/* Sidebar - всегда показан, сворачивается в полоску */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {currentChatId ? (
            <ChatView />
          ) : (
            <PromptGallery />
          )}
        </main>

        {/* Modals */}
        <AnimatePresence>
          <Settings />
        </AnimatePresence>
        
        <ProvidersPanel />
        
        <ProfilePanel 
          isOpen={profileOpen} 
          onClose={toggleProfile} 
        />
      </div>
    </ThemeProvider>
  )
}
