/**
 * groqClient.ts
 * Thin wrapper around Groq REST API.
 * No SDK dependency — just fetch.
 */

const GROQ_BASE = "https://api.groq.com/openai/v1"

// ─── Transcription ────────────────────────────────────────────────────────────

export async function transcribeAudio(
  apiKey: string,
  audioBlob: Blob
): Promise<string> {
  const formData = new FormData()
  formData.append("file", audioBlob, "audio.webm")
  formData.append("model", "whisper-large-v3")
  formData.append("response_format", "text")
  formData.append("language", "en")

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Transcription failed (${res.status}): ${err}`)
  }

  const text = await res.text()
  return text.trim()
}

// ─── Chat Completion ─────────────────────────────────────────────────────────

export interface GroqChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface CompletionOptions {
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export async function chatCompletion(
  apiKey: string,
  messages: GroqChatMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Chat completion failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ""
}

/**
 * Streaming chat completion — calls onToken for each text delta,
 * resolves with the full concatenated text when done.
 */
export async function streamingChatCompletion(
  apiKey: string,
  messages: GroqChatMessage[],
  onToken: (token: string) => void,
  options: CompletionOptions = {}
): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-maverick-17b-128e-instruct",
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Streaming chat failed (${res.status}): ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))

    for (const line of lines) {
      const payload = line.slice(6)
      if (payload === "[DONE]") continue
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content ?? ""
        if (delta) {
          full += delta
          onToken(delta)
        }
      } catch {
        // malformed SSE chunk — skip
      }
    }
  }

  return full
}
