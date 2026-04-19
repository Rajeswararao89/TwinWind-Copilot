/**
 * suggestionService.ts
 *
 * Generates suggestion batches and detailed expansions from transcript text.
 */

import { chatCompletion } from "./groqClient"
import type { GroqChatMessage } from "./groqClient"
import type { Suggestion, SuggestionBatch, AppSettings } from "./types"

let batchCounter = 0

interface RawSuggestion {
  type: string
  preview: string
  detail: string
}

/**
 * Generate a fresh batch of 3 suggestions from the recent transcript context.
 */
export async function generateSuggestions(
  transcript: string,
  settings: AppSettings
): Promise<SuggestionBatch> {
  const contextText = trimToTokenBudget(transcript, settings.suggestionContextTokens)

  const userMessage = `## Live Conversation Transcript (recent context)\n\n${contextText}`

  const raw = await chatCompletion(
    settings.groqApiKey,
    [
      { role: "system", content: settings.suggestionPrompt },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.6, max_tokens: 700 }
  )

  const suggestions = parseSuggestions(raw)
  const batchId = `batch-${Date.now()}-${batchCounter++}`

  return {
    id: batchId,
    suggestions,
    transcriptSnapshot: contextText,
    timestamp: Date.now(),
  }
}

/**
 * Expand a suggestion into a full detailed answer using broader transcript context.
 */
export async function expandSuggestion(
  suggestion: Suggestion,
  fullTranscript: string,
  settings: AppSettings
): Promise<string> {
  const contextText = trimToTokenBudget(fullTranscript, settings.detailContextTokens)

  const userMessage = `## Full Conversation Transcript\n\n${contextText}

## Suggestion to Expand
Type: ${suggestion.type}
Preview: ${suggestion.preview}

Please provide a detailed, immediately useful response for this suggestion.`

  return chatCompletion(
    settings.groqApiKey,
    [
      { role: "system", content: settings.detailPrompt },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.5, max_tokens: 500 }
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse the model's JSON response into Suggestion objects.
 * Falls back gracefully if JSON is malformed.
 */
function parseSuggestions(raw: string): Suggestion[] {
  let json: { suggestions?: RawSuggestion[] } = {}

  try {
    // Strip potential markdown fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim()
    json = JSON.parse(cleaned)
  } catch {
    // If JSON parse fails, attempt to extract partial data
    console.warn("Suggestion JSON parse failed. Raw:", raw.slice(0, 300))
  }

  const rawSuggestions: RawSuggestion[] = Array.isArray(json.suggestions)
    ? json.suggestions
    : []

  return rawSuggestions
    .slice(0, 3)
    .map((s, i): Suggestion => ({
      id: `sug-${Date.now()}-${i}`,
      type: validateType(s.type),
      preview: s.preview ?? "No preview available.",
      detail: s.detail ?? "No detail available.",
      timestamp: Date.now(),
    }))
}

const VALID_TYPES = new Set(["question", "talking_point", "answer", "fact_check", "clarification"])

function validateType(t: unknown): Suggestion["type"] {
  return typeof t === "string" && VALID_TYPES.has(t)
    ? (t as Suggestion["type"])
    : "talking_point"
}

/**
 * Trim text to approximately `budget` characters, keeping the *most recent* content.
 * (Most recent = end of transcript is most useful for live suggestions.)
 */
export function trimToTokenBudget(text: string, charBudget: number): string {
  if (text.length <= charBudget) return text
  // Keep the last `charBudget` characters — most recent is most relevant
  return "…[earlier transcript omitted]\n\n" + text.slice(-charBudget)
}
