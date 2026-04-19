/**
 * SuggestionsColumn.tsx
 * Middle column: batches of 3 suggestion cards, newest at top.
 */

import React from "react"
import { RefreshCw, HelpCircle, Lightbulb, CheckCircle, Search, BookOpen } from "lucide-react"
import type { Suggestion, SuggestionBatch } from "./types"

interface Props {
  batches: SuggestionBatch[]
  isLoading: boolean
  onRefresh: () => void
  onSuggestionClick: (suggestion: Suggestion) => void
  hasTranscript: boolean
  isRecording: boolean
}

export function SuggestionsColumn({
  batches,
  isLoading,
  onRefresh,
  onSuggestionClick,
  hasTranscript,
  isRecording,
}: Props) {
  return (
    <div className="column suggestions-column">
      <div className="column-header">
        <span className="column-title">Live Suggestions</span>
        <button
          className={`refresh-btn ${isLoading ? "spinning" : ""}`}
          onClick={onRefresh}
          disabled={isLoading || !hasTranscript}
          title="Refresh suggestions"
        >
          <RefreshCw size={11} />
          {isLoading ? "Generating…" : "Refresh"}
        </button>
      </div>

      <div className="column-body">
        {batches.length === 0 ? (
          <div className="suggestions-empty">
            {isLoading ? (
              <>
                Generating suggestions…
                <br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>Analysing transcript</span>
              </>
            ) : isRecording && !hasTranscript ? (
              <>
                <span style={{ color: "var(--type-answer)" }}>● Recording</span>
                <br />
                First suggestions arrive in ~30s
                <br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  Waiting for first transcript chunk
                </span>
              </>
            ) : isRecording && hasTranscript ? (
              <>
                <span style={{ color: "var(--type-answer)" }}>● Recording</span>
                <br />
                Suggestions generating…
                <br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  Or click Refresh to trigger now
                </span>
              </>
            ) : (
              <>
                Press <strong>Record</strong> to start
                <br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  Suggestions appear here every 30s
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="suggestion-batches">
            {/* newest batch first */}
            {[...batches].reverse().map((batch, batchIdx) => (
              <div key={batch.id} className="suggestion-batch">
                <div className="batch-label">
                  {batchIdx === 0 ? "Latest" : formatTime(batch.timestamp)}
                </div>
                {batch.suggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onClick={() => onSuggestionClick(s)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Individual Card ──────────────────────────────────────────────────────────

interface CardProps {
  suggestion: Suggestion
  onClick: () => void
}

function SuggestionCard({ suggestion, onClick }: CardProps) {
  const { icon, label } = TYPE_META[suggestion.type] ?? TYPE_META.talking_point

  return (
    <button
      className={`suggestion-card type-${suggestion.type}`}
      onClick={onClick}
    >
      <div className="card-type-badge">
        {icon}
        {label}
      </div>
      <div className="card-preview">{suggestion.preview}</div>
    </button>
  )
}

// ─── Type metadata ────────────────────────────────────────────────────────────

const TYPE_META: Record<
  Suggestion["type"],
  { icon: React.ReactNode; label: string }
> = {
  question: { icon: <HelpCircle size={9} />, label: "Question to Ask" },
  talking_point: { icon: <Lightbulb size={9} />, label: "Talking Point" },
  answer: { icon: <CheckCircle size={9} />, label: "Answer" },
  fact_check: { icon: <Search size={9} />, label: "Fact Check" },
  clarification: { icon: <BookOpen size={9} />, label: "Clarification" },
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}
