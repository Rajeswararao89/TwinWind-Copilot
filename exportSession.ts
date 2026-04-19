/**
 * exportSession.ts
 * Exports the full session as a JSON file.
 */

import type { TranscriptChunk, SuggestionBatch, ChatMessage, SessionExport } from "./types"

export function exportSession(
  transcript: TranscriptChunk[],
  suggestionBatches: SuggestionBatch[],
  chat: ChatMessage[]
): void {
  const payload: SessionExport = {
    exportedAt: new Date().toISOString(),
    transcript,
    suggestionBatches,
    chat,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `twinmind-session-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
