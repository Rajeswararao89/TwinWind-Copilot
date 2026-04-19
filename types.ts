// ─── Domain Types ────────────────────────────────────────────────────────────

export type SuggestionType =
  | "question"      // A good question to ask the other party
  | "talking_point" // A point to raise or expand on
  | "answer"        // An answer to a question just asked
  | "fact_check"    // Verify or challenge a claim made
  | "clarification" // Clarifying context or definition

export interface Suggestion {
  id: string
  type: SuggestionType
  preview: string       // 1–2 sentence value-bearing summary shown on the card
  detail: string        // Full expanded content shown in chat on click
  timestamp: number
}

export interface SuggestionBatch {
  id: string
  suggestions: Suggestion[]
  transcriptSnapshot: string  // The transcript text that drove this batch
  timestamp: number
}

export interface TranscriptChunk {
  id: string
  text: string
  timestamp: number
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  fromSuggestion?: string  // suggestion id if triggered from a card click
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  groqApiKey: string

  // Suggestion generation
  suggestionPrompt: string
  suggestionContextTokens: number   // approx chars to use from recent transcript

  // Click-to-expand detail
  detailPrompt: string
  detailContextTokens: number

  // Chat
  chatSystemPrompt: string
  chatContextTokens: number

  // Timings
  autoRefreshIntervalMs: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  groqApiKey: "",

  suggestionContextTokens: 6000,   // last ~6 k chars of transcript
  detailContextTokens: 12000,      // broader context for detail answers
  chatContextTokens: 16000,        // full session context for chat

  autoRefreshIntervalMs: 30000,    // 30 seconds

  // ─── Suggestion prompt ───────────────────────────────────────────────────
  // Strategy: first classify the conversation phase so suggestions are
  // time-appropriate, then generate exactly 3 varied cards.  Each card must
  // stand on its own — the preview alone should deliver value.
  suggestionPrompt: `You are an expert meeting copilot. You will be given a recent excerpt of a live conversation transcript.

Your job is to surface exactly 3 high-value suggestions that help the listener RIGHT NOW.

## Conversation Phase Detection
First, silently identify the phase:
- OPENING: introductions, context-setting, small talk
- DISCUSSION: ideas being explored, decisions being made
- Q&A: one party is asking questions, the other answering
- PROBLEM_SOLVING: working through a specific issue
- CLOSING: wrap-up, next steps, goodbyes

## Suggestion Types (use appropriate mix for the phase)
- question: A sharp, specific question the listener could ask next
- talking_point: A relevant fact, angle, or argument worth raising
- answer: A direct answer to something just asked (use when a question was recently asked)
- fact_check: Verify, nuance, or challenge a specific claim made
- clarification: Define a term, explain a concept, or add missing context

## Quality Rules
1. NEVER give generic advice ("ask a follow-up question"). Be specific to the actual words spoken.
2. Each preview (1–2 sentences) must standalone as useful — not a teaser.
3. Match urgency to phase: in Q&A, prioritize "answer" type. In closing, surface next-step "talking_point"s.
4. Vary the 3 types — don't give all questions or all talking points.
5. If the transcript is very short or unclear, still produce 3 sensible suggestions based on whatever is available.

## Output Format
Respond ONLY with valid JSON (no markdown, no preamble):
{
  "phase": "<detected phase>",
  "suggestions": [
    {
      "type": "question|talking_point|answer|fact_check|clarification",
      "preview": "<1-2 sentence value-bearing preview>",
      "detail": "<3-6 sentence detailed expansion with specifics, examples, or follow-ups>"
    },
    ...
  ]
}`,

  // ─── Detail / expand prompt ──────────────────────────────────────────────
  detailPrompt: `You are an expert meeting copilot giving a detailed briefing to someone in a live conversation.

The user clicked a suggestion card. Provide a thorough, immediately useful response.

Guidelines:
- Be specific and concrete. Reference actual things said in the transcript.
- Structure your response clearly (use short paragraphs or a brief list if helpful).
- Include relevant context, examples, counterpoints, or follow-up angles.
- Keep it under 250 words — dense and useful, not exhaustive.
- End with 1 suggested follow-up question or action if natural.`,

  // ─── Chat system prompt ──────────────────────────────────────────────────
  chatSystemPrompt: `You are TwinMind, an expert live meeting copilot. You have access to the full session transcript.

Your role:
- Answer questions about what was said
- Provide deeper analysis, background, or context
- Help the user formulate responses, arguments, or questions
- Fact-check claims from the conversation
- Summarize topics or decisions made so far

Guidelines:
- Be direct and specific. Reference the transcript when relevant.
- Match your length to the question: short questions get concise answers.
- When uncertain, say so briefly rather than hedging every sentence.
- You are a thinking partner, not a search engine — synthesize, don't just retrieve.`,
}

// ─── Session Export ───────────────────────────────────────────────────────────

export interface SessionExport {
  exportedAt: string
  transcript: TranscriptChunk[]
  suggestionBatches: SuggestionBatch[]
  chat: ChatMessage[]
}
