/**
 * App.tsx
 * Root component — wires together audio capture, transcription,
 * suggestion generation, and chat.
 */

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Settings, Download } from "lucide-react"

import { useAudioRecorder } from "./useAudioRecorder"
import { transcribeAudio, streamingChatCompletion } from "./groqClient"
import { generateSuggestions, expandSuggestion, trimToTokenBudget } from "./suggestionService"
import { exportSession } from "./exportSession"
import { SettingsModal } from "./SettingsModal"
import { TranscriptColumn } from "./TranscriptColumn"
import { SuggestionsColumn } from "./SuggestionsColumn"
import { ChatColumn } from "./ChatColumn"

import type {
  TranscriptChunk,
  SuggestionBatch,
  ChatMessage,
  Suggestion,
  AppSettings,
} from "./types"
import { DEFAULT_SETTINGS } from "./types"

// ─── Persist settings in localStorage ────────────────────────────────────────

const SETTINGS_KEY = "twinmind_settings"

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [showSettings, setShowSettings] = useState(!loadSettings().groqApiKey)

  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)

  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([])
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")

  const [error, setError] = useState<string | null>(null)

  // Keep a ref to the latest transcript text so callbacks don't go stale
  const transcriptRef = useRef("")
  const settingsRef = useRef(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // ─── Full transcript text ───────────────────────────────────────────────

  const getFullTranscript = useCallback(() => transcriptRef.current, [])

  // ─── Audio + Transcription ──────────────────────────────────────────────

  const { isRecording, startRecording, stopRecording, error: recorderError } =
    useAudioRecorder()

  useEffect(() => {
    if (recorderError) setError(recorderError)
  }, [recorderError])

  const handleAudioChunk = useCallback(async (blob: Blob) => {
    const s = settingsRef.current
    if (!s.groqApiKey) return

    setIsTranscribing(true)
    try {
      const text = await transcribeAudio(s.groqApiKey, blob)
      if (!text) return

      const chunk: TranscriptChunk = {
        id: `chunk-${Date.now()}`,
        text,
        timestamp: Date.now(),
      }

      setTranscriptChunks((prev) => {
        const updated = [...prev, chunk]
        transcriptRef.current = updated.map((c) => c.text).join("\n\n")
        return updated
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transcription error")
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  const handleStartRecording = useCallback(() => {
    if (!settings.groqApiKey) {
      setShowSettings(true)
      return
    }
    startRecording(handleAudioChunk)
  }, [settings.groqApiKey, startRecording, handleAudioChunk])

  // ─── Suggestion Generation ──────────────────────────────────────────────

  const handleRefreshSuggestions = useCallback(async () => {
    const transcript = transcriptRef.current
    if (!transcript || isSuggestionsLoading) return

    const s = settingsRef.current
    if (!s.groqApiKey) return

    setIsSuggestionsLoading(true)
    try {
      const batch = await generateSuggestions(transcript, s)
      setSuggestionBatches((prev) => [...prev, batch])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Suggestion generation error")
    } finally {
      setIsSuggestionsLoading(false)
    }
  }, [isSuggestionsLoading])

  // Auto-refresh suggestions every N seconds while recording
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)

    if (isRecording) {
      // First refresh fires after one full chunk interval
      autoRefreshRef.current = setInterval(() => {
        if (transcriptRef.current) {
          handleRefreshSuggestions()
        }
      }, settings.autoRefreshIntervalMs)
    }

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
  }, [isRecording, settings.autoRefreshIntervalMs, handleRefreshSuggestions])

  // ─── Suggestion click → expand → chat ──────────────────────────────────

  const handleSuggestionClick = useCallback(async (suggestion: Suggestion) => {
    const s = settingsRef.current
    if (!s.groqApiKey) return

    // Add user message in chat (the suggestion preview as the prompt)
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: suggestion.preview,
      timestamp: Date.now(),
      fromSuggestion: suggestion.id,
    }
    setChatMessages((prev) => [...prev, userMsg])

    setIsStreaming(true)
    setStreamingContent("")

    let fullResponse = ""

    try {
      // Generate detailed expansion
      const transcript = getFullTranscript()
      fullResponse = await expandSuggestion(suggestion, transcript, s)
    } catch (e: unknown) {
      fullResponse = e instanceof Error ? `Error: ${e.message}` : "An error occurred."
    }

    // Commit the streamed response
    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-a`,
      role: "assistant",
      content: fullResponse,
      timestamp: Date.now(),
    }
    setChatMessages((prev) => [...prev, assistantMsg])
    setIsStreaming(false)
    setStreamingContent("")
  }, [getFullTranscript])

  // ─── User chat message ──────────────────────────────────────────────────

  const handleChatSend = useCallback(async (text: string) => {
    const s = settingsRef.current
    if (!s.groqApiKey) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    }
    setChatMessages((prev) => [...prev, userMsg])

    setIsStreaming(true)
    setStreamingContent("")

    // Build context-aware messages for chat
    const transcript = getFullTranscript()
    const transcriptContext = trimToTokenBudget(transcript, s.chatContextTokens)

    const systemContent = transcript
      ? `${s.chatSystemPrompt}\n\n## Full Session Transcript\n\n${transcriptContext}`
      : s.chatSystemPrompt

    // Build conversation history (last 20 messages to avoid context overflow)
    const recentHistory = [...chatMessages, userMsg]
      .slice(-20)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    let accumulated = ""
    try {
      accumulated = await streamingChatCompletion(
        s.groqApiKey,
        [{ role: "system", content: systemContent }, ...recentHistory],
        (token) => {
          setStreamingContent((prev) => prev + token)
        },
        { temperature: 0.65, max_tokens: 800 }
      )
    } catch (e: unknown) {
      accumulated = e instanceof Error ? `Error: ${e.message}` : "An error occurred."
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-a`,
      role: "assistant",
      content: accumulated,
      timestamp: Date.now(),
    }
    setChatMessages((prev) => [...prev, assistantMsg])
    setIsStreaming(false)
    setStreamingContent("")
  }, [chatMessages, getFullTranscript])

  // ─── Settings save ──────────────────────────────────────────────────────

  const handleSaveSettings = useCallback((s: AppSettings) => {
    setSettings(s)
    saveSettings(s)
  }, [])

  // ─── Error auto-dismiss ─────────────────────────────────────────────────

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(t)
  }, [error])

  // ─── Export ─────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    exportSession(transcriptChunks, suggestionBatches, chatMessages)
  }, [transcriptChunks, suggestionBatches, chatMessages])

  // ─── Render ─────────────────────────────────────────────────────────────

  const hasTranscript = transcriptChunks.length > 0
  const noApiKey = !settings.groqApiKey

  return (
    <>
      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-brand">
            <span className="dot" />
            TwinMind Copilot
          </div>
          <div className="header-actions">
            <button
              className="btn-icon"
              onClick={handleExport}
              title="Export session"
              disabled={!hasTranscript && chatMessages.length === 0}
            >
              <Download size={15} />
            </button>
            <button
              className="btn-icon"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <Settings size={15} />
            </button>
          </div>
        </header>

        {/* Three columns */}
        <TranscriptColumn
          chunks={transcriptChunks}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          onStartRecording={handleStartRecording}
          onStopRecording={stopRecording}
          noApiKey={noApiKey}
        />

        <SuggestionsColumn
          batches={suggestionBatches}
          isLoading={isSuggestionsLoading}
          onRefresh={handleRefreshSuggestions}
          onSuggestionClick={handleSuggestionClick}
          hasTranscript={hasTranscript}
        />

        <ChatColumn
          messages={chatMessages}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          onSend={handleChatSend}
        />
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Error toast */}
      {error && <div className="error-toast">{error}</div>}
    </>
  )
}
