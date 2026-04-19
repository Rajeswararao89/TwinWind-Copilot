/**
 * TranscriptColumn.tsx
 * Left column: mic control + live transcript chunks.
 */

import React, { useEffect, useRef } from "react"
import { Mic, MicOff } from "lucide-react"
import type { TranscriptChunk } from "./types"

interface Props {
  chunks: TranscriptChunk[]
  isRecording: boolean
  isTranscribing: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  noApiKey: boolean
}

export function TranscriptColumn({
  chunks,
  isRecording,
  isTranscribing,
  onStartRecording,
  onStopRecording,
  noApiKey,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new chunk arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chunks.length])

  return (
    <div className="column transcript-column">
      <div className="column-header">
        <span className="column-title">Transcript</span>
        <button
          className={`mic-btn ${isRecording ? "recording" : ""}`}
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={noApiKey}
          title={noApiKey ? "Add your Groq API key in Settings" : undefined}
        >
          {isRecording ? (
            <>
              <span className="pulse" />
              Stop
            </>
          ) : (
            <>
              <Mic size={13} />
              Record
            </>
          )}
        </button>
      </div>

      <div className="column-body">
        {noApiKey && (
          <div className="no-key-banner">
            ⚡ Add your Groq API key in Settings to begin.
          </div>
        )}

        {chunks.length === 0 ? (
          <div className="transcript-empty">
            {isRecording ? (
              <>
                Listening…
                <br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  First chunk arrives in ~30 s
                </span>
              </>
            ) : (
              <>
                Press <strong>Record</strong> to start
                <br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  Transcript appears here in real time
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="transcript-chunks">
            {chunks.map((chunk) => (
              <div key={chunk.id} className="transcript-chunk">
                <div className="chunk-timestamp">
                  {formatTime(chunk.timestamp)}
                </div>
                <div className="chunk-text">{chunk.text}</div>
              </div>
            ))}
            {isTranscribing && (
              <div className="transcript-chunk">
                <div className="chunk-text" style={{ color: "var(--text-muted)" }}>
                  Transcribing…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}
