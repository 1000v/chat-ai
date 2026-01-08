'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match
          
          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-sm text-pink-400" {...props}>
                {children}
              </code>
            )
          }

          return (
            <CodeBlock language={match[1]} code={String(children).replace(/\n$/, '')} />
          )
        },
        pre({ children }) {
          return <>{children}</>
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              {children}
            </a>
          )
        },
        ul({ children }) {
          return <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-zinc-700 pl-4 my-2 text-zinc-400 italic">
              {children}
            </blockquote>
          )
        },
        h1({ children }) {
          return <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-base font-bold mt-2 mb-1">{children}</h3>
        },
        p({ children }) {
          return <p className="my-2">{children}</p>
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-zinc-700 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          )
        },
        th({ children }) {
          return <th className="px-4 py-2 bg-zinc-800 text-left font-medium">{children}</th>
        },
        td({ children }) {
          return <td className="px-4 py-2 border-t border-zinc-700">{children}</td>
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700">
        <span className="text-xs text-zinc-500">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-zinc-700 transition-colors"
        >
          {copied ? (
            <Check size={14} className="text-green-500" />
          ) : (
            <Copy size={14} className="text-zinc-500" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: '#18181b',
          fontSize: '0.875rem'
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
