/**
 * useAudioRecorder.ts
 *
 * Captures mic audio in 30-second chunks.
 * Each chunk is emitted as a Blob so the caller can transcribe it.
 */

import { useRef, useCallback, useState } from "react"

interface UseAudioRecorderReturn {
  isRecording: boolean
  startRecording: (onChunk: (blob: Blob) => void) => Promise<void>
  stopRecording: () => void
  error: string | null
}

const CHUNK_INTERVAL_MS = 30_000

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onChunkRef = useRef<((blob: Blob) => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    setIsRecording(false)
  }, [])

  /**
   * Rotate the MediaRecorder: stop the current one (fires ondataavailable
   * with the buffered data) and immediately start a fresh one on the same
   * stream so there's no gap in capture.
   */
  const rotateRecorder = useCallback((stream: MediaStream) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop() // triggers ondataavailable
    }

    const mr = new MediaRecorder(stream, { mimeType: getBestMimeType() })

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        onChunkRef.current?.(e.data)
      }
    }

    mr.start()
    mediaRecorderRef.current = mr
  }, [])

  const startRecording = useCallback(
    async (onChunk: (blob: Blob) => void) => {
      setError(null)
      onChunkRef.current = onChunk

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        })
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Microphone access denied"
        setError(msg)
        return
      }

      streamRef.current = stream

      // Start first recorder segment
      rotateRecorder(stream)
      setIsRecording(true)

      // Every CHUNK_INTERVAL_MS, cut a new segment
      timerRef.current = setInterval(() => {
        rotateRecorder(stream)
      }, CHUNK_INTERVAL_MS)
    },
    [rotateRecorder]
  )

  return { isRecording, startRecording, stopRecording, error }
}

function getBestMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ""
}
