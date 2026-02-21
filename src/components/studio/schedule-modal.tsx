"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (scheduledAt: Date) => Promise<void>;
  selectedContent: string | null;
  selectedImageUrl: string | null;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatLocalDate(tomorrow);
}

function getTodayDate(): string {
  return formatLocalDate(new Date());
}

export function ScheduleModal({
  open,
  onOpenChange,
  onSchedule,
  selectedContent,
  selectedImageUrl,
}: ScheduleModalProps) {
  const [date, setDate] = useState(getTomorrowDate);
  const [time, setTime] = useState("09:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = date && time && !isSubmitting;

  const handleSchedule = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`);
      await onSchedule(scheduledAt);
    } catch {
      // Parent handles the error toast; keep modal open
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="schedule-modal" className="rounded-2xl p-6 sm:max-w-md bg-white border border-black/5 shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
        <DialogHeader>
          <DialogTitle data-testid="schedule-modal-title" className="flex items-center gap-2 text-lg font-bold">
            <span className="material-symbols-outlined text-[#ee5b2b]">
              calendar_today
            </span>
            Schedule Your Post
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Pick a date and time to publish your post.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Content preview */}
          {selectedContent && (
            <div className="bg-white rounded-2xl border border-black/5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] p-4 max-h-32 overflow-hidden">
              <div className="flex gap-3">
                {selectedImageUrl && (
                  <img
                    src={selectedImageUrl}
                    alt="Selected"
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                )}
                <p className="text-sm text-gray-600 line-clamp-3">
                  {selectedContent.length > 120
                    ? `${selectedContent.slice(0, 120)}...`
                    : selectedContent}
                </p>
              </div>
            </div>
          )}

          {/* Date picker */}
          <div className="space-y-2">
            <label
              htmlFor="schedule-date"
              className="flex items-center gap-2 text-sm font-medium text-gray-700"
            >
              <span className="material-symbols-outlined text-[#ee5b2b] text-xl">
                calendar_today
              </span>
              Date
            </label>
            <input
              id="schedule-date"
              type="date"
              value={date}
              min={getTodayDate()}
              onChange={(e) => setDate(e.target.value)}
              data-testid="schedule-input-date"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#ee5b2b] focus:ring-2 focus:ring-[#ee5b2b]/20 focus:outline-none transition-colors"
            />
          </div>

          {/* Time picker */}
          <div className="space-y-2">
            <label
              htmlFor="schedule-time"
              className="flex items-center gap-2 text-sm font-medium text-gray-700"
            >
              <span className="material-symbols-outlined text-[#ee5b2b] text-xl">
                schedule
              </span>
              Time
            </label>
            <input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              data-testid="schedule-input-time"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#ee5b2b] focus:ring-2 focus:ring-[#ee5b2b]/20 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-between sm:justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            data-testid="schedule-btn-cancel"
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSchedule}
            disabled={!canSubmit}
            data-testid="schedule-btn-confirm"
            className="rounded-xl bg-gradient-to-r from-[#ee5b2b] to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#ee5b2b]/20 flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="material-symbols-outlined text-lg">
              rocket_launch
            </span>
            {isSubmitting ? "Scheduling..." : "Schedule"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
