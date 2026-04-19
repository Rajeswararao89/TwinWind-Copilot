/**
 * ChatColumn.tsx
 * Right column: continuous chat with streaming responses.
 */

import React, { useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import type { ChatMessage } from "./types"

interface Props {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  onSend: (text: string) => void
}

export function ChatColumn({ messages, isStreaming, streamingContent, onSend }: Props) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, streamingContent])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput("")
    onSend(text)
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Auto-grow textarea
    const ta = e.target
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  return (
    <div className="column chat-column">
      <div className="column-header">
        <span className="column-title">Chat</span>
      </div>

      <div className="column-body">
        {messages.length === 0 && !isStreaming ? (
          <div className="chat-empty">
            Click a suggestion or type a question
            <br />
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              Uses full session context
            </span>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming response */}
            {isStreaming && (
              <div className="chat-message assistant">
                <div className="message-bubble">
                  {streamingContent || ""}
                  <span className="streaming-cursor" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Ask anything about the conversation…"
            rows={1}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            title="Send (Enter)"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Single message bubble ────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`chat-message ${message.role}`}>
      <div className="message-bubble">{message.content}</div>
      <div className="message-time">{formatTime(message.timestamp)}</div>
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}
