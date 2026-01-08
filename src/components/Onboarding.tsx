'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Zap, Crown, Database, ArrowRight } from 'lucide-react'
import { Button, Toggle } from './ui'
import { useStore } from '@/store'
import type { UserMode } from '@/types'

const modes = [
  {
    id: 'simple' as UserMode,
    name: 'Simple',
    description: 'Только чат без анализа',
    icon: Sparkles,
    features: ['Базовый чат с ИИ', 'Без анализа профиля', 'Быстрый старт']
  },
  {
    id: 'standard' as UserMode,
    name: 'Standard',
    description: 'Чат + анализ с подтверждением',
    icon: Zap,
    features: ['Анализ разговоров', 'Предложения для профиля', 'Ручное подтверждение']
  },
  {
    id: 'pro' as UserMode,
    name: 'Pro',
    description: 'Полная автоматизация',
    icon: Crown,
    features: ['Авто-обновление профиля', 'Динамические промпты', 'Полный контроль']
  }
]

export function Onboarding() {
  const { updateSettings, setOnboarded, settings } = useStore()
  const [selectedMode, setSelectedMode] = useState<UserMode>(settings.mode)
  const [syncMemory, setSyncMemory] = useState(settings.syncMemory)

  const handleComplete = () => {
    updateSettings({ mode: selectedMode, syncMemory })
    setOnboarded(true)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-zinc-100 mb-3">
            Добро пожаловать в AI Chat
          </h1>
          <p className="text-zinc-400 text-lg">
            Настройте систему под себя
          </p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-100 mb-6">Выберите режим работы</h2>
          
          <div className="grid gap-4 mb-8">
            {modes.map((mode) => {
              const Icon = mode.icon
              const isSelected = selectedMode === mode.id
              return (
                <motion.button
                  key={mode.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${isSelected ? 'bg-blue-500' : 'bg-zinc-700'}`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-zinc-100">{mode.name}</h3>
                        <span className="text-sm text-zinc-500">{mode.description}</span>
                      </div>
                      <ul className="flex flex-wrap gap-2 mt-2">
                        {mode.features.map((feature) => (
                          <li key={feature} className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>

          <div className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-800 mb-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-zinc-700">
                <Database size={24} className="text-zinc-300" />
              </div>
              <div className="flex-1">
                <Toggle
                  checked={syncMemory}
                  onChange={setSyncMemory}
                  label="Синхронизация памяти"
                  description="Глобальный профиль для всех чатов или локальная память для каждого"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleComplete} size="lg" className="w-full gap-2">
            Начать работу
            <ArrowRight size={20} />
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
