'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { 
  Bold, Italic, List, ListOrdered, Quote, Code, 
  Heading1, Heading2, Heading3, Undo, Redo, Eye, Edit3
} from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export function MarkdownEditor({ value, onChange, placeholder = 'Напишите что-нибудь...', minHeight = '200px' }: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // Convert to markdown-like format
      onChange(editor.getText())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none'
      }
    }
  })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editor) return
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault()
            editor.chain().focus().toggleBold().run()
            break
          case 'i':
            e.preventDefault()
            editor.chain().focus().toggleItalic().run()
            break
          case '`':
            e.preventDefault()
            editor.chain().focus().toggleCode().run()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editor])

  if (!editor) return null

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden bg-zinc-900">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-zinc-800 bg-zinc-800/50 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Жирный (Ctrl+B)"
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Курсив (Ctrl+I)"
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Код (Ctrl+`)"
        >
          <Code size={16} />
        </ToolbarButton>
        
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Заголовок 1"
        >
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Заголовок 2"
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Заголовок 3"
        >
          <Heading3 size={16} />
        </ToolbarButton>
        
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Маркированный список"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Нумерованный список"
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Цитата"
        >
          <Quote size={16} />
        </ToolbarButton>
        
        <div className="flex-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Отменить (Ctrl+Z)"
        >
          <Undo size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Повторить (Ctrl+Y)"
        >
          <Redo size={16} />
        </ToolbarButton>
        
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        
        <ToolbarButton
          onClick={() => setIsPreview(!isPreview)}
          isActive={isPreview}
          title={isPreview ? 'Редактировать' : 'Предпросмотр'}
        >
          {isPreview ? <Edit3 size={16} /> : <Eye size={16} />}
        </ToolbarButton>
      </div>

      {/* Editor / Preview */}
      <div style={{ minHeight }} className="p-4">
        {isPreview ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <MarkdownRenderer content={value} />
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  )
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        isActive ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}
