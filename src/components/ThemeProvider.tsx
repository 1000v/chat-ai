'use client'

import { useEffect } from 'react'
import { useStore } from '@/store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useStore()
  
  useEffect(() => {
    const root = document.documentElement
    
    const applyTheme = (theme: 'light' | 'dark') => {
      if (theme === 'light') {
        root.classList.add('light')
        root.classList.remove('dark')
      } else {
        root.classList.add('dark')
        root.classList.remove('light')
      }
    }
    
    if (settings.theme === 'auto') {
      // Слушаем системную тему
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mediaQuery.matches ? 'dark' : 'light')
      
      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light')
      }
      
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    } else {
      applyTheme(settings.theme)
    }
  }, [settings.theme])
  
  return <>{children}</>
}
