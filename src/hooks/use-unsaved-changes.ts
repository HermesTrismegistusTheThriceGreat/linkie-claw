"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UseUnsavedChangesOptions {
    hasChanges: boolean;
    onSave: () => Promise<void>;
}

interface UseUnsavedChangesReturn {
    showDialog: boolean;
    pendingHref: string | null;
    handleDiscard: () => void;
    handleSave: () => Promise<void>;
    handleCancel: () => void;
    guardNavigation: (href: string) => boolean;
}

export function useUnsavedChanges({
    hasChanges,
    onSave,
}: UseUnsavedChangesOptions): UseUnsavedChangesReturn {
    const router = useRouter();
    const [showDialog, setShowDialog] = useState(false);
    const [pendingHref, setPendingHref] = useState<string | null>(null);

    // Layer 1: Browser-level beforeunload for tab close / refresh / external nav
    useEffect(() => {
        if (!hasChanges) return;

        function handleBeforeUnload(e: BeforeUnloadEvent) {
            e.preventDefault();
            // Modern browsers ignore custom messages but still show the native dialog
            e.returnValue = "";
        }

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasChanges]);

    // Layer 2: In-app navigation guard — called from Sidebar's onBeforeNavigate
    const guardNavigation = useCallback(
        (href: string): boolean => {
            if (!hasChanges) return true; // no dirty state, allow navigation
            setPendingHref(href);
            setShowDialog(true);
            return false; // block navigation, show dialog
        },
        [hasChanges]
    );

    const handleCancel = useCallback(() => {
        setShowDialog(false);
        setPendingHref(null);
    }, []);

    const handleDiscard = useCallback(() => {
        setShowDialog(false);
        const href = pendingHref;
        setPendingHref(null);
        if (href) {
            router.push(href);
        }
    }, [pendingHref, router]);

    const handleSave = useCallback(async () => {
        try {
            await onSave();
            setShowDialog(false);
            const href = pendingHref;
            setPendingHref(null);
            if (href) {
                router.push(href);
            }
        } catch {
            // Save failed — keep dialog open so user sees the error
            // The editor's own error handling will display the message
            setShowDialog(false);
            setPendingHref(null);
        }
    }, [onSave, pendingHref, router]);

    return {
        showDialog,
        pendingHref,
        handleDiscard,
        handleSave,
        handleCancel,
        guardNavigation,
    };
}
