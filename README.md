# TwinMind Copilot

A live AI meeting copilot that listens to your mic, transcribes in real time, and continuously surfaces 3 contextually-aware suggestions. Click any suggestion to get a detailed answer in the chat panel.

**Live demo:** `<your-vercel-url>`

---

## Quick Start

```bash
git clone <repo>
cd twinmind-copilot
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000), click ⚙️ Settings, paste your [Groq API key](https://console.groq.com), and hit **Record**.

---

## Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React 18 + TypeScript | Strict typing catches bugs early; no routing needed |
| Transcription | Groq Whisper Large V3 | Fastest whisper inference available; far lower latency than OpenAI |
| LLM | `meta-llama/llama-4-maverick-17b-128e-instruct` on Groq | Assignment specifies GPT-OSS 120B class; Maverick is the closest Groq-hosted equivalent in that weight class |
| Styling | Plain CSS with design tokens | Zero runtime overhead; full control; no Tailwind purge issues |
| Deployment | Vercel (static React build) | Zero config, instant CDN |

No backend — all API calls go directly from the browser to Groq. The API key never leaves the browser (stored in `localStorage`).

---

## Architecture

```
src/
├── types.ts              # All domain types + DEFAULT_SETTINGS (prompts live here)
├── groqClient.ts         # Thin fetch wrapper — transcription, chat, streaming
├── useAudioRecorder.ts   # Web Audio API hook, 30s chunk rotation
├── suggestionService.ts  # generateSuggestions() + expandSuggestion()
├── exportSession.ts      # JSON export utility
├── App.tsx               # Root orchestrator — all state lives here
├── TranscriptColumn.tsx  # Left column
├── SuggestionsColumn.tsx # Middle column
├── ChatColumn.tsx        # Right column
├── SettingsModal.tsx     # Editable settings (prompts, context windows, timings)
└── index.css             # Design tokens + layout
```

### Data Flow

```
Mic → MediaRecorder (30s chunks)
         ↓
    Whisper Large V3 (Groq)
         ↓
   TranscriptChunks[]  ──────────────────────────────────┐
         ↓                                                │
  every 30s auto-trigger                                  │
         ↓                                             (full ctx)
  generateSuggestions()                                   │
  [last 6k chars of transcript]                           ↓
         ↓                                         chatCompletion()
   SuggestionBatch                                 [last 16k chars]
         ↓
  click → expandSuggestion()
  [last 12k chars of transcript]
         ↓
   Chat panel (streaming)
```

---

## Prompt Strategy

This is the core of the product. Here's the reasoning behind every decision.

### 1. Suggestion Prompt — Phase Detection First

The single biggest failure mode in live suggestion systems is **context mismatch** — surfacing a "question to ask" when someone just *asked* a question and needs an *answer*, or giving a fact-check when it's just small talk.

My solution: force the model to **silently classify the conversation phase** before generating suggestions. The five phases are:

- `OPENING` — introductions, context-setting
- `DISCUSSION` — exploring ideas, debating
- `Q&A` — one party asking, the other answering
- `PROBLEM_SOLVING` — working through a specific issue
- `CLOSING` — wrap-up, next steps

Each phase maps to a different optimal suggestion mix. In `Q&A` mode, `answer` type suggestions are prioritized. In `CLOSING`, `talking_point` suggestions shift toward action items and next steps.

### 2. Five Suggestion Types (not a flat list)

Generic copilots produce a flat list of "follow-up questions." That's boring and low-value. I defined 5 types, each serving a different cognitive need:

| Type | When surfaced | Example |
|------|--------------|---------|
| `question` | Discussion, opening | "Ask them to clarify their timeline assumptions" |
| `talking_point` | Discussion, closing | "Mention the 40% cost reduction from case study X" |
| `answer` | Q&A (question just asked) | "The answer to their ROI question: typical payback is 18 months" |
| `fact_check` | Anytime a claim is made | "Their '95% accuracy' claim — industry benchmarks put this at 78%" |
| `clarification` | Jargon or ambiguity | "They said 'MLOps pipeline' — this refers to automated model deployment" |

The prompt explicitly forbids giving all-questions or all-talking-points. The 3 suggestions must be varied.

### 3. Preview = Value, Not a Teaser

A common mistake: make the preview a vague hook that forces a click ("There's an important point about the timeline…"). This is deceptive UX and annoying.

My rule: **the preview must stand alone as useful**. If you never click the card, you still got value. The detail just goes deeper — specifics, examples, counterpoints, follow-up angles.

### 4. Context Window Strategy

- **Suggestions** use the **last 6,000 chars** of transcript (recent = most relevant for what to do next)
- **Detail expansions** use the **last 12,000 chars** (broader context to give a thorough answer)  
- **Chat** uses the **last 16,000 chars** (full session context for anything the user asks)

All three are configurable in Settings. The defaults were chosen to stay well within Groq's context limits while keeping latency low.

### 5. No Transcript = Graceful Degradation

If the transcript is empty or very short, the model still produces 3 suggestions based on whatever context exists. No hard failures, no blank states.

### 6. Temperature Tuning

- Suggestions: `0.6` — varied but grounded (too high → hallucinated claims)
- Detail expansions: `0.5` — more precise, fact-oriented
- Chat: `0.65` — conversational but not sloppy

---

## Latency Profile

| Operation | Typical latency |
|-----------|----------------|
| Whisper transcription (30s chunk) | ~1.5–2.5s |
| Suggestion generation (3 cards) | ~1.5–3s |
| Detail expansion (click) | ~2–4s |
| Chat first token (streaming) | ~0.4–0.8s |

Chat uses streaming so the user sees tokens appear immediately — the perceived latency is ~400ms to first word.

---

## Settings (all configurable in-app)

All settings are editable live in ⚙️ Settings and persisted to `localStorage`.

| Setting | Default | Purpose |
|---------|---------|---------|
| `groqApiKey` | — | Your Groq API key |
| `suggestionContextTokens` | 6,000 chars | Recent transcript window for suggestion generation |
| `detailContextTokens` | 12,000 chars | Transcript window for click-to-expand |
| `chatContextTokens` | 16,000 chars | Transcript window injected into chat system prompt |
| `autoRefreshIntervalMs` | 30,000ms | How often suggestions auto-regenerate while recording |
| `suggestionPrompt` | (see `types.ts`) | Full system prompt for suggestion generation |
| `detailPrompt` | (see `types.ts`) | System prompt for click-to-expand answers |
| `chatSystemPrompt` | (see `types.ts`) | System prompt for the chat panel |

Prompts are editable directly in the Settings modal. The defaults in `types.ts` represent the best values found through iteration.

---

## Export Format

Clicking ↓ exports a JSON file with this shape:

```json
{
  "exportedAt": "2024-01-15T14:32:00.000Z",
  "transcript": [
    { "id": "chunk-1", "text": "...", "timestamp": 1705329120000 }
  ],
  "suggestionBatches": [
    {
      "id": "batch-1",
      "timestamp": 1705329150000,
      "transcriptSnapshot": "...",
      "suggestions": [
        {
          "id": "sug-1",
          "type": "question",
          "preview": "...",
          "detail": "...",
          "timestamp": 1705329150000
        }
      ]
    }
  ],
  "chat": [
    { "id": "msg-1", "role": "user", "content": "...", "timestamp": 1705329160000 },
    { "id": "msg-2", "role": "assistant", "content": "...", "timestamp": 1705329161000 }
  ]
}
```

---

## Tradeoffs & Known Limitations

**No streaming for suggestions** — suggestions are returned as a single JSON blob. Streaming partial JSON would require a more complex parser and adds fragility. Given suggestions take ~2s, this is acceptable. Chat *does* stream.

**No speaker diarization** — Whisper transcribes all audio as one speaker. A production system would want diarization to know who said what (especially for `answer` suggestions).

**30s fixed chunk size** — This is the sweet spot for Whisper accuracy. Shorter chunks have higher transcription error rates. Longer chunks delay the first transcript.

**localStorage for settings** — Appropriate for a demo/personal tool. A multi-user system would need server-side storage.

**Context trimming keeps the tail** — When the transcript exceeds the context budget, we drop the beginning (oldest). This is the right call for live suggestions where recency matters most. For a post-meeting summary, you'd want the full transcript.

---

## Deployment

### Vercel (recommended)

```bash
npm install -g vercel
vercel --prod
```

### Netlify

```bash
npm run build
# Drag the build/ folder to netlify.com/drop
```

### Any static host

```bash
npm run build
# Serve the build/ directory
```

No server-side environment variables needed — the API key is entered by the user in the browser.
