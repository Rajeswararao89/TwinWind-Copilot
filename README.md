# TwinMind Copilot

A live AI meeting copilot that listens to your mic, transcribes in real time, and continuously surfaces 3 contextually-aware suggestions. Click any suggestion to get a streaming detailed answer in the chat panel.

**Live demo:** https://twin-wind-copilot.vercel.app  
**GitHub:** https://github.com/Rajeswararao89/TwinWind-Copilot

---

## Quick Start

```bash
git clone https://github.com/Rajeswararao89/TwinWind-Copilot.git
cd TwinWind-Copilot
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000), click ⚙️ Settings, paste your [Groq API key](https://console.groq.com), and hit **Record**.

---

## Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React 18 + TypeScript | Strict typing catches bugs early; clean component-per-column architecture |
| Build tool | Vite 5 | Faster builds than CRA; no peer dependency conflicts with React 18 |
| Transcription | Groq Whisper Large V3 | Fastest Whisper inference available; ~1.5s per 30s chunk |
| LLM | `openai/gpt-oss-120b` on Groq | Exact model specified in the assignment; best reasoning quality on Groq |
| Styling | Plain CSS with design tokens | Zero runtime overhead; full control over every detail |
| Deployment | Vercel | Zero config, instant CDN, auto-redeploys on push |

No backend — all API calls go directly from the browser to Groq. The API key is stored in the user's own `localStorage` and never touches a server.

---

## File Structure

All source files live at the repo root (flat structure, no `src/` subfolder):

```
TwinWind-Copilot/
├── index.html              # Vite entry point — script tag points to index.tsx
├── vite.config.ts          # Vite config
├── tsconfig.json           # TypeScript config (moduleResolution: bundler)
├── package.json
├── vercel.json             # Output dir: dist, framework: vite
│
├── types.ts                # All domain types + DEFAULT_SETTINGS (prompts live here)
├── groqClient.ts           # Thin fetch wrapper — transcription, chat, streaming
├── useAudioRecorder.ts     # Web Audio API hook — 30s chunk rotation, zero capture gap
├── suggestionService.ts    # generateSuggestions() with previous-batch dedup
├── exportSession.ts        # JSON export utility
│
├── App.tsx                 # Root orchestrator — all state + data flow
├── TranscriptColumn.tsx    # Left column — mic button + auto-scrolling chunks
├── SuggestionsColumn.tsx   # Middle column — batched cards, phase-aware empty states
├── ChatColumn.tsx          # Right column — streaming chat + auto-growing input
├── SettingsModal.tsx       # Editable prompts, context windows, timings
└── index.css               # Design tokens + 3-column layout
```

---

## Data Flow

```
Mic → MediaRecorder (30s chunk rotation)
         ↓
    Whisper Large V3 (Groq) ~1.5s
         ↓
   TranscriptChunks[]  ─────────────────────────────────────┐
         ↓                                                   │
  every 30s auto-trigger (or manual Refresh)                 │
         ↓                                                (full ctx)
  generateSuggestions()                                      │
  [last 6k chars + previous batch previews]                  ↓
         ↓                                          streamingChatCompletion()
   SuggestionBatch (3 cards)                        [last 16k chars of transcript]
         ↓
  click card → streamingChatCompletion()
  [last 12k chars + suggestion context]
         ↓
   Chat panel — tokens appear word-by-word (~400ms to first token)
```

---

## Prompt Strategy

This is the core of the product. Every decision is deliberate.

### 1. Phase Detection Before Suggestions

The #1 failure mode in live copilots is **context mismatch** — showing "here's a question to ask" when someone just asked a question and needs an *answer*. The fix: force the model to silently classify the conversation phase first.

Five phases:
- `OPENING` — introductions, context-setting
- `DISCUSSION` — ideas being explored, decisions being made
- `Q&A` — one party asking, the other answering
- `PROBLEM_SOLVING` — working through a specific issue
- `CLOSING` — wrap-up, next steps

Each phase drives a different suggestion mix. In `Q&A`, `answer` type cards are prioritized. In `CLOSING`, `talking_point` cards shift toward action items.

### 2. Five Typed Suggestions (not a flat list)

Generic copilots give 3 follow-up questions. That's one-dimensional. Each of the 5 types serves a different cognitive need:

| Type | When surfaced | Value |
|------|--------------|-------|
| `question` | Discussion, Opening | Drive the conversation forward |
| `talking_point` | Discussion, Closing | Surface facts or angles worth raising |
| `answer` | Q&A — after a question is asked | Help you respond immediately |
| `fact_check` | Any claim is made | Verify or challenge with specifics |
| `clarification` | Jargon or ambiguity | Level the playing field |

The prompt explicitly requires variety — no batch can be all-questions or all-talking-points.

### 3. Previous Batch Deduplication

Every refresh passes the last batch's 3 previews into the prompt:

> *"These were the previous suggestions — generate 3 that are meaningfully different."*

This prevents the model from repeating the same cards every 30 seconds, which is one of the most noticeable failure modes in live copilots.

### 4. Preview = Value, Not a Teaser

Cards must stand alone as useful even if never clicked. A preview that says *"There's an important point about the timeline…"* is a teaser — annoying and low-value. The rule enforced in the prompt: the preview itself must deliver the insight. The detail expands on it with specifics, examples, and follow-up angles.

### 5. Three Context Window Sizes

| Use | Window | Reason |
|-----|--------|--------|
| Suggestions | Last 6,000 chars | Recency matters most for what to say next |
| Click-to-expand | Last 12,000 chars | Broader context for thorough answers |
| Chat | Last 16,000 chars | Full session for anything the user asks |

All three are configurable in Settings.

### 6. Streaming on Everything User-Facing

- **Chat messages** — stream word-by-word via SSE, first token in ~400ms
- **Suggestion click expansions** — also streamed, same perceived latency as chat
- **Suggestion generation** — non-streaming (returns a JSON blob). Streaming partial JSON would require an incremental parser and adds fragility for minimal gain at ~2s total latency.

### 7. Temperature Tuning

| Task | Temp | Reason |
|------|------|--------|
| Suggestions | 0.6 | Varied but grounded — higher risks hallucinated claims |
| Detail expansions | 0.5 | Precise and fact-oriented |
| Chat | 0.65 | Conversational without being sloppy |

---

## Latency Profile

| Operation | Typical latency |
|-----------|----------------|
| Whisper transcription (30s audio chunk) | ~1.5–2.5s |
| Suggestion generation (3 cards) | ~2–3s |
| Suggestion card click — first streaming token | ~400ms |
| Chat — first streaming token | ~400ms |

---

## Settings (all editable in-app)

All settings persist to `localStorage`. Editable live via ⚙️ in the header — no redeploy needed.

| Setting | Default | Purpose |
|---------|---------|---------|
| `groqApiKey` | — | Your Groq API key (never sent to any server) |
| `suggestionContextTokens` | 6,000 chars | Recent transcript window for suggestion generation |
| `detailContextTokens` | 12,000 chars | Transcript window for click-to-expand |
| `chatContextTokens` | 16,000 chars | Transcript window injected into chat system prompt |
| `autoRefreshIntervalMs` | 30,000ms | How often suggestions auto-regenerate while recording |
| `suggestionPrompt` | see `types.ts` | Full system prompt for suggestion generation |
| `detailPrompt` | see `types.ts` | System prompt for click-to-expand answers |
| `chatSystemPrompt` | see `types.ts` | System prompt for the chat panel |

The defaults in `types.ts` are the optimal values found through iteration.

---

## Export Format

The ↓ button exports a timestamped JSON file with the complete session:

```json
{
  "exportedAt": "2026-04-19T16:30:00.000Z",
  "transcript": [
    { "id": "chunk-1", "text": "...", "timestamp": 1745000000000 }
  ],
  "suggestionBatches": [
    {
      "id": "batch-1",
      "timestamp": 1745000030000,
      "transcriptSnapshot": "...",
      "suggestions": [
        {
          "id": "sug-1",
          "type": "question",
          "preview": "...",
          "detail": "...",
          "timestamp": 1745000030000
        }
      ]
    }
  ],
  "chat": [
    { "id": "msg-1", "role": "user", "content": "...", "timestamp": 1745000060000 },
    { "id": "msg-2", "role": "assistant", "content": "...", "timestamp": 1745000061000 }
  ]
}
```

---

## Key Engineering Decisions

**MediaRecorder rotation over timeslice** — Instead of using `timeslice` to get continuous micro-chunks, the recorder is stopped and immediately restarted every 30s on the same stream. This gives Whisper complete utterances, significantly improving transcription accuracy with zero gap between chunks.

**No backend** — Direct browser→Groq calls. No infrastructure to maintain, no latency hop, no server-side key storage needed. The tradeoff (key visible in DevTools) is acceptable for a personal copilot tool.

**`transcriptRef` + `settingsRef`** — Mutable refs that mirror state, used inside async callbacks to prevent stale closure bugs where a callback captures an outdated value of transcript or settings.

**`suggestionBatchesRef`** — Keeps a ref-copy of the batches array so `handleRefreshSuggestions` can read the last batch's previews without adding batches as a dependency (which would reset the auto-refresh interval on every new batch).

**Flat file structure** — All source files at the repo root instead of a `src/` subfolder. Required because the project was scaffolded directly on GitHub. Vite handles this cleanly with the `index.html` script tag pointing to `/index.tsx`.

**Vite over Create React App** — CRA has unresolved peer dependency conflicts with React 18 and newer npm versions. Vite is faster, actively maintained, and the current industry standard.

---

## Tradeoffs & Known Limitations

**No speaker diarization** — Whisper transcribes all audio as one speaker. Production would use pyannote or a diarization-enabled API (AssemblyAI, Deepgram) so suggestions can reference who said what.

**30s fixed chunk size** — Sweet spot for Whisper accuracy. Shorter chunks produce higher error rates on incomplete sentences. Longer chunks delay the first transcript appearance.

**localStorage for settings** — Right for a single-user demo. A multi-user SaaS would encrypt and store keys server-side.

**Context trimming keeps the tail** — When transcript exceeds the budget, oldest content is dropped. Correct for live suggestions where recency wins. A production system would use a summarisation pass to compress old context rather than discarding it.

---

## Deployment

### Vercel (used for live demo)

```bash
npm install -g vercel
vercel --prod
```

### Local dev

```bash
npm install
npm start        # Vite dev server on port 3000
```

### Build

```bash
npm run build    # outputs to dist/
```

No environment variables needed server-side. The Groq API key is entered by the user in the browser Settings modal.
