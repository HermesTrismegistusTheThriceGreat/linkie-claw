"use client";

import { useState } from "react";
import type { VoiceTone } from "@/lib/voice-tones";
import { DEFAULT_VOICE_TONES, VOICE_TONE_LIMITS } from "@/lib/voice-tones";

interface VoiceTonesEditorProps {
    initialTones: VoiceTone[];
    onSave: (tones: VoiceTone[]) => Promise<{ success: boolean; error?: string }>;
    onReset: () => Promise<{ success: boolean; error?: string }>;
}

export function VoiceTonesEditor({ initialTones, onSave, onReset }: VoiceTonesEditorProps) {
    const [tones, setTones] = useState<VoiceTone[]>(initialTones);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Track if user has made changes
    const hasChanges = JSON.stringify(tones) !== JSON.stringify(initialTones);

    // Check if current tones match defaults (ignoring potential key order differences by re-stringifying)
    // But reliable way is to check content. For simplicity here:
    const isDefault = JSON.stringify(tones) === JSON.stringify(DEFAULT_VOICE_TONES);

    function updateTone(id: string, field: "name" | "prompt", value: string) {
        setTones(prev =>
            prev.map(tone => (tone.id === id ? { ...tone, [field]: value } : tone))
        );
        setSaveStatus("idle");
    }

    async function handleSave() {
        setIsSaving(true);
        setSaveStatus("idle");
        setErrorMessage(null);

        try {
            const result = await onSave(tones);
            if (result.success) {
                setSaveStatus("success");
                setTimeout(() => setSaveStatus("idle"), 3000);
            } else {
                setSaveStatus("error");
                setErrorMessage(result.error ?? "Failed to save");
            }
        } catch {
            setSaveStatus("error");
            setErrorMessage("An unexpected error occurred");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleReset() {
        if (!confirm("Are you sure you want to reset all voice tones to their defaults? This cannot be undone.")) {
            return;
        }

        setIsResetting(true);
        try {
            const result = await onReset();
            if (result.success) {
                setTones(DEFAULT_VOICE_TONES);
                setSaveStatus("idle");
                setErrorMessage(null);
            } else {
                setSaveStatus("error");
                setErrorMessage(result.error ?? "Failed to reset");
            }
        } catch {
            setSaveStatus("error");
            setErrorMessage("Failed to reset");
        } finally {
            setIsResetting(false);
        }
    }

    return (
        <div className="space-y-6" data-testid="voice-tones-editor">
            {/* Editor cards - 2 column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tones.map((tone, index) => (
                    <div
                        key={tone.id}
                        className="glass-card p-6 rounded-3xl border border-white/50 shadow-sm space-y-4"
                        data-testid={`voice-tone-card-${tone.id}`}
                    >
                        {/* Slot number badge */}
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                                {index + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Style Slot
                            </span>
                        </div>

                        {/* Style name input */}
                        <div>
                            <label
                                htmlFor={`tone-name-${tone.id}`}
                                className="block text-sm font-bold text-slate-600 mb-1"
                            >
                                Style Name
                            </label>
                            <input
                                id={`tone-name-${tone.id}`}
                                data-testid={`tone-name-${tone.id}`}
                                type="text"
                                value={tone.name}
                                onChange={(e) => updateTone(tone.id, "name", e.target.value)}
                                maxLength={VOICE_TONE_LIMITS.NAME_MAX_LENGTH}
                                className="w-full px-4 py-2 rounded-xl border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold"
                                placeholder="e.g., Storytelling"
                            />
                            <span className="text-xs text-slate-400 mt-1">
                                {tone.name.length}/{VOICE_TONE_LIMITS.NAME_MAX_LENGTH}
                            </span>
                        </div>

                        {/* Prompt description textarea */}
                        <div>
                            <label
                                htmlFor={`tone-prompt-${tone.id}`}
                                className="block text-sm font-bold text-slate-600 mb-1"
                            >
                                Prompt Description
                            </label>
                            <textarea
                                id={`tone-prompt-${tone.id}`}
                                data-testid={`tone-prompt-${tone.id}`}
                                value={tone.prompt}
                                onChange={(e) => updateTone(tone.id, "prompt", e.target.value)}
                                maxLength={VOICE_TONE_LIMITS.PROMPT_MAX_LENGTH}
                                rows={3}
                                className="w-full px-4 py-2 rounded-xl border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                placeholder="Describe the voice and tone for this style..."
                            />
                            <span className="text-xs text-slate-400 mt-1">
                                {tone.prompt.length}/{VOICE_TONE_LIMITS.PROMPT_MAX_LENGTH}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between glass-card p-4 rounded-2xl border border-white/50 shadow-sm sticky bottom-6 bg-white/80 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    {/* Reset button */}
                    <button
                        data-testid="reset-voice-tones"
                        onClick={handleReset}
                        disabled={isDefault || isResetting}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {isResetting ? "Resetting..." : "Reset to Defaults"}
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {/* Status feedback */}
                    {saveStatus === "success" && (
                        <span className="text-sm font-bold text-green-600 animate-pulse" aria-live="polite">
                            Saved successfully
                        </span>
                    )}
                    {saveStatus === "error" && (
                        <span className="text-sm font-bold text-red-600" aria-live="polite">
                            {errorMessage}
                        </span>
                    )}

                    {/* Save button */}
                    <button
                        data-testid="save-voice-tones"
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        aria-busy={isSaving}
                        className="px-6 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary/20"
                    >
                        {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}
