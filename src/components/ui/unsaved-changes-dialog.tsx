"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UnsavedChangesDialogProps {
    open: boolean;
    onDiscard: () => void;
    onSave: () => Promise<void>;
    onCancel: () => void;
    isSaving?: boolean;
}

export function UnsavedChangesDialog({
    open,
    onDiscard,
    onSave,
    onCancel,
    isSaving = false,
}: UnsavedChangesDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent showCloseButton={false} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500">warning</span>
                        You have unsaved changes
                    </DialogTitle>
                    <DialogDescription>
                        Your changes will be lost if you leave this page without saving.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-row gap-2 sm:justify-end">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        disabled={isSaving}
                        data-testid="unsaved-dialog-cancel"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onDiscard}
                        disabled={isSaving}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid="unsaved-dialog-discard"
                    >
                        Discard Changes
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={isSaving}
                        data-testid="unsaved-dialog-save"
                    >
                        {isSaving ? "Saving..." : "Save & Leave"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
