'use client'

import { motion } from 'framer-motion'
import { X, Sparkles, Zap, Crown, Database, Key, Palette, Brain, Sliders, Bug } from 'lucide-react'
import { useStore } from '@/store'
import { Button, Toggle } from './ui'
import type { UserMode, UserSettings } from '@/types'

// Font family mapping
function getFontFamily(fontId: string): string {
  const fonts: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    inter: '"Inter", sans-serif',
    roboto: '"Roboto", sans-serif',
    jetbrains: '"JetBrains Mono", monospace',
    fira: '"Fira Code", monospace'
  }
  return fonts[fontId] || fonts.system
}

const modes: { id: UserMode; name: string; icon: React.ElementType; description: string }[] = [
  { id: 'simple', name: 'Simple', icon: Sparkles, description: 'Только чат' },
  { id: 'standard', name: 'Standard', icon: Zap, description: 'Чат + анализ с подтверждением' },
  { id: 'pro', name: 'Pro', icon: Crown, description: 'Авто-анализ и применение' }
]

export function Settings() {
  const { settingsOpen, toggleSettings, settings, updateSettings, toggleProviders, providers } = useStore()

  if (!settingsOpen) return null

  const enabledProviders = providers.filter(p => p.enabled)
  
  // Get all available models for analyzer selection
  const allModels = enabledProviders.flatMap(p => 
    p.models.map(m => ({ providerId: p.id, providerName: p.name, model: m }))
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={toggleSettings}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-4 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-100">Настройки</h2>
          <button
            onClick={toggleSettings}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-8">
          {/* Mode Selection */}
          <section>
            <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
              <Zap size={20} className="text-blue-400" />
              Режим работы
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {modes.map((mode) => {
                const Icon = mode.icon
                const isSelected = settings.mode === mode.id
                return (
                  <button
                    key={mode.id}
                    onClick={() => updateSettings({ mode: mode.id })}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <Icon size={24} className={`mx-auto mb-2 ${isSelected ? 'text-blue-400' : 'text-zinc-500'}`} />
                    <p className={`font-medium ${isSelected ? 'text-blue-400' : 'text-zinc-300'}`}>{mode.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{mode.description}</p>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Analyzer Settings (for Standard and Pro modes) */}
          {settings.mode !== 'simple' && (
            <section>
              <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
                <Brain size={20} className="text-purple-400" />
                Анализатор (Gemini)
              </h3>
              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Модель для анализа</label>
                  <select
                    value={settings.analyzerModel ? `${settings.analyzerProviderId}:${settings.analyzerModel}` : ''}
                    onChange={(e) => {
                      const [providerId, model] = e.target.value.split(':')
                      updateSettings({ analyzerProviderId: providerId, analyzerModel: model })
                    }}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Выберите модель</option>
                    {allModels.map((m, i) => (
                      <option key={`${m.providerId}-${m.model}-${i}`} value={`${m.providerId}:${m.model}`}>
                        {m.model} ({m.providerName})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-600 mt-1">
                    Рекомендуется: Gemini 2.0 Flash для быстрого анализа
                  </p>
                </div>
                
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block flex items-center gap-2">
                    <Sliders size={14} />
                    Интервал анализа: {settings.analyzerInterval} сообщений
                  </label>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    step="5"
                    value={settings.analyzerInterval}
                    onChange={(e) => updateSettings({ analyzerInterval: parseInt(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-600 mt-1">
                    <span>25 (частый)</span>
                    <span>100 (редкий)</span>
                  </div>
                </div>
                
                {settings.mode === 'standard' && (
                  <p className="text-xs text-zinc-500 bg-zinc-900 p-2 rounded">
                    В режиме Standard анализатор создаёт предложения, которые нужно подтвердить вручную
                  </p>
                )}
                {settings.mode === 'pro' && (
                  <p className="text-xs text-purple-400 bg-purple-500/10 p-2 rounded">
                    В режиме Pro анализатор автоматически применяет изменения с высокой уверенностью
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Memory Sync */}
          <section>
            <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
              <Database size={20} className="text-blue-400" />
              Память
            </h3>
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <Toggle
                checked={settings.syncMemory}
                onChange={(checked) => updateSettings({ syncMemory: checked })}
                label="Синхронизация памяти"
                description="Глобальный профиль для всех чатов"
              />
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
              <Palette size={20} className="text-blue-400" />
              Оформление
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column - settings */}
              <div className="space-y-4">
                {/* Theme selection */}
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Тема</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['light', 'dark', 'auto'] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => updateSettings({ theme })}
                        className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                          settings.theme === theme
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <p className={`text-sm font-medium ${settings.theme === theme ? 'text-blue-400' : 'text-zinc-300'}`}>
                          {theme === 'light' ? 'Светлая' : theme === 'dark' ? 'Тёмная' : 'Авто'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font selection */}
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Шрифт</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'system', name: 'Системный' },
                      { id: 'inter', name: 'Inter' },
                      { id: 'roboto', name: 'Roboto' },
                      { id: 'jetbrains', name: 'JetBrains' },
                      { id: 'fira', name: 'Fira Code' },
                    ].map((font) => (
                      <button
                        key={font.id}
                        onClick={() => updateSettings({ fontFamily: font.id as UserSettings['fontFamily'] })}
                        className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                          settings.fontFamily === font.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <p className={`text-sm ${settings.fontFamily === font.id ? 'text-blue-400' : 'text-zinc-300'}`}
                           style={{ fontFamily: getFontFamily(font.id) }}>
                          {font.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font size slider */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm text-zinc-400">Размер шрифта</label>
                    <span className="text-sm font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      {settings.fontSize || 14}px
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="12"
                      max="20"
                      step="1"
                      value={settings.fontSize || 14}
                      onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 
                        [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-400
                        [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                    />
                    <div className="flex justify-between text-xs text-zinc-600 mt-2">
                      <span style={{ fontSize: '12px' }}>A</span>
                      <span style={{ fontSize: '16px' }}>A</span>
                      <span style={{ fontSize: '20px' }}>A</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column - preview */}
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <label className="text-sm text-zinc-400 mb-3 block">Предпросмотр</label>
                <div className="space-y-3">
                  {/* User message preview */}
                  <div className="flex justify-end">
                    <div 
                      className="bg-blue-600 text-white rounded-2xl px-4 py-2.5 max-w-[80%]"
                      style={{ 
                        fontFamily: getFontFamily(settings.fontFamily || 'system'),
                        fontSize: `${settings.fontSize || 14}px`
                      }}
                    >
                      Привет! Как дела?
                    </div>
                  </div>
                  
                  {/* Assistant message preview */}
                  <div className="flex justify-start">
                    <div 
                      className="bg-zinc-700 text-zinc-100 rounded-2xl px-4 py-2.5 max-w-[80%]"
                      style={{ 
                        fontFamily: getFontFamily(settings.fontFamily || 'system'),
                        fontSize: `${settings.fontSize || 14}px`
                      }}
                    >
                      <p className="mb-2">Привет! Всё отлично, спасибо что спросил.</p>
                      <p className="mb-2">Вот пример кода:</p>
                      <pre className="bg-zinc-800 rounded p-2 text-xs overflow-x-auto">
                        <code>{`const hello = "world";
console.log(hello);`}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="text-xs text-zinc-500 text-center pt-2 border-t border-zinc-700">
                    Шрифт: {settings.fontFamily || 'system'} • Размер: {settings.fontSize || 14}px
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* API Providers */}
          <section>
            <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
              <Key size={20} className="text-blue-400" />
              AI Провайдеры
            </h3>
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-200">
                    {enabledProviders.length > 0 
                      ? `${enabledProviders.length} активных провайдеров`
                      : 'Нет активных провайдеров'
                    }
                  </p>
                  <p className="text-sm text-zinc-500">
                    {enabledProviders.map(p => p.name).join(', ') || 'Добавьте провайдер для работы с ИИ'}
                  </p>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => {
                    toggleSettings()
                    setTimeout(toggleProviders, 100)
                  }}
                >
                  Настроить
                </Button>
              </div>
            </div>
          </section>

          {/* Debug Mode */}
          <section>
            <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
              <Bug size={20} className="text-orange-400" />
              Отладка
            </h3>
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <Toggle
                checked={settings.debugMode || false}
                onChange={(checked) => updateSettings({ debugMode: checked })}
                label="Режим отладки"
                description="Показывать детали API запросов в консоли и сообщениях"
              />
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  )
}
