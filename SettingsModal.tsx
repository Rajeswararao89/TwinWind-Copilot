/**
 * SettingsModal.tsx
 * Editable settings panel — API key, prompts, context sizes, timings.
 */

import React, { useState } from "react"
import { X } from "lucide-react"
import type { AppSettings } from "./types"

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

export function SettingsModal({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings })

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* API Key */}
          <div className="field-group">
            <label className="field-label">Groq API Key</label>
            <input
              className="field-input"
              type="password"
              placeholder="gsk_..."
              value={draft.groqApiKey}
              onChange={(e) => set("groqApiKey", e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Context windows */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="field-group">
              <label className="field-label">Suggestion Context (chars)</label>
              <input
                className="field-input"
                type="number"
                min={500}
                max={30000}
                value={draft.suggestionContextTokens}
                onChange={(e) => set("suggestionContextTokens", parseInt(e.target.value) || 6000)}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Detail Context (chars)</label>
              <input
                className="field-input"
                type="number"
                min={500}
                max={60000}
                value={draft.detailContextTokens}
                onChange={(e) => set("detailContextTokens", parseInt(e.target.value) || 12000)}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Chat Context (chars)</label>
              <input
                className="field-input"
                type="number"
                min={500}
                max={60000}
                value={draft.chatContextTokens}
                onChange={(e) => set("chatContextTokens", parseInt(e.target.value) || 16000)}
              />
            </div>
          </div>

          {/* Auto-refresh */}
          <div className="field-group" style={{ maxWidth: 220 }}>
            <label className="field-label">Auto-refresh Interval (ms)</label>
            <input
              className="field-input"
              type="number"
              min={10000}
              max={120000}
              step={5000}
              value={draft.autoRefreshIntervalMs}
              onChange={(e) => set("autoRefreshIntervalMs", parseInt(e.target.value) || 30000)}
            />
          </div>

          {/* Suggestion Prompt */}
          <div className="field-group">
            <label className="field-label">Live Suggestion Prompt</label>
            <textarea
              className="field-textarea"
              style={{ minHeight: 180 }}
              value={draft.suggestionPrompt}
              onChange={(e) => set("suggestionPrompt", e.target.value)}
            />
          </div>

          {/* Detail Prompt */}
          <div className="field-group">
            <label className="field-label">Detail Expansion Prompt (on click)</label>
            <textarea
              className="field-textarea"
              style={{ minHeight: 120 }}
              value={draft.detailPrompt}
              onChange={(e) => set("detailPrompt", e.target.value)}
            />
          </div>

          {/* Chat System Prompt */}
          <div className="field-group">
            <label className="field-label">Chat System Prompt</label>
            <textarea
              className="field-textarea"
              style={{ minHeight: 140 }}
              value={draft.chatSystemPrompt}
              onChange={(e) => set("chatSystemPrompt", e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => { onSave(draft); onClose() }}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
