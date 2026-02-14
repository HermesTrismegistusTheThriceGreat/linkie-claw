"use client";

import { useState } from "react";
import type { ImageStyle } from "@/lib/image-styles";
import { DEFAULT_IMAGE_STYLES, IMAGE_STYLE_LIMITS } from "@/lib/image-styles";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { Sidebar } from "@/components/layout/sidebar";

interface ImageStylesEditorProps {
    initialStyles: ImageStyle[];
    onSave: (styles: ImageStyle[]) => Promise<{ success: boolean; error?: string }>;
    onReset: () => Promise<{ success: boolean; error?: string }>;
    user?: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
}

export function ImageStylesEditor({ initialStyles, onSave, onReset, user }: ImageStylesEditorProps) {
    const [styles, setStyles] = useState<ImageStyle[]>(initialStyles);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Track if user has made changes
    const hasChanges = JSON.stringify(styles) !== JSON.stringify(initialStyles);

    // Check if current styles match defaults
    const isDefault = JSON.stringify(styles) === JSON.stringify(DEFAULT_IMAGE_STYLES);

    // Unsaved changes guard
    const {
        showDialog,
        handleDiscard,
        handleSave: handleDialogSave,
        handleCancel,
        guardNavigation,
    } = useUnsavedChanges({
        hasChanges,
        onSave: async () => {
            await handleSave();
        },
    });

    function updateStyle(id: string, field: "name" | "prompt", value: string) {
        setStyles(prev =>
            prev.map(style => (style.id === id ? { ...style, [field]: value } : style))
        );
        setSaveStatus("idle");
    }

    async function handleSave() {
        setIsSaving(true);
        setSaveStatus("idle");
        setErrorMessage(null);

        try {
            const result = await onSave(styles);
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
        if (!confirm("Are you sure you want to reset all image styles to their defaults? This cannot be undone.")) {
            return;
        }

        setIsResetting(true);
        try {
            const result = await onReset();
            if (result.success) {
                setStyles(DEFAULT_IMAGE_STYLES);
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
        <>
            {/* Sidebar with navigation guard */}
            <Sidebar user={user} onBeforeNavigate={guardNavigation} />

            {/* Main content */}
            <main className="flex-1 overflow-y-auto z-10">
                <div className="max-w-6xl mx-auto p-10 space-y-8">
                    <div>
                        <h1 className="text-4xl font-bold">Image Styles</h1>
                        <p className="text-slate-500 mt-2">
                            Customize the visual styles used to generate your images.
                            Each of the 6 slots corresponds to a different visual medium.
                        </p>
                    </div>

                    <div className="space-y-6" data-testid="image-styles-editor">
                        {/* Editor cards - 2 column grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {styles.map((style, index) => (
                                <div
                                    key={style.id}
                                    className="glass-card p-6 rounded-3xl border border-white/50 shadow-sm space-y-4"
                                    data-testid={`image-style-card-${style.id}`}
                                >
                                    {/* Slot number badge */}
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                                            {index + 1}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            Style Slot ({style.id})
                                        </span>
                                    </div>

                                    {/* Style name input */}
                                    <div>
                                        <label
                                            htmlFor={`style-name-${style.id}`}
                                            className="block text-sm font-bold text-slate-600 mb-1"
                                        >
                                            Display Name
                                        </label>
                                        <input
                                            id={`style-name-${style.id}`}
                                            data-testid={`style-name-${style.id}`}
                                            type="text"
                                            value={style.name}
                                            onChange={(e) => updateStyle(style.id, "name", e.target.value)}
                                            maxLength={IMAGE_STYLE_LIMITS.NAME_MAX_LENGTH}
                                            className="w-full px-4 py-2 rounded-xl border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold"
                                            placeholder="e.g., Photography"
                                        />
                                        <span className="text-xs text-slate-400 mt-1">
                                            {style.name.length}/{IMAGE_STYLE_LIMITS.NAME_MAX_LENGTH}
                                        </span>
                                    </div>

                                    {/* Prompt description textarea */}
                                    <div>
                                        <label
                                            htmlFor={`style-prompt-${style.id}`}
                                            className="block text-sm font-bold text-slate-600 mb-1"
                                        >
                                            Visual Style Prompt
                                        </label>
                                        <textarea
                                            id={`style-prompt-${style.id}`}
                                            data-testid={`style-prompt-${style.id}`}
                                            value={style.prompt}
                                            onChange={(e) => updateStyle(style.id, "prompt", e.target.value)}
                                            maxLength={IMAGE_STYLE_LIMITS.PROMPT_MAX_LENGTH}
                                            rows={3}
                                            className="w-full px-4 py-2 rounded-xl border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                            placeholder="Describe the visual style..."
                                        />
                                        <span className="text-xs text-slate-400 mt-1">
                                            {style.prompt.length}/{IMAGE_STYLE_LIMITS.PROMPT_MAX_LENGTH}
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
                                    data-testid="reset-image-styles"
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
                                    data-testid="save-image-styles"
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
                </div>
            </main>

            {/* Unsaved changes confirmation dialog */}
            <UnsavedChangesDialog
                open={showDialog}
                onDiscard={handleDiscard}
                onSave={handleDialogSave}
                onCancel={handleCancel}
                isSaving={isSaving}
            />
        </>
    );
}
