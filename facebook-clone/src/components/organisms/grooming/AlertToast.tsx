import React, { useEffect, useRef, useState } from 'react';
import { STAGE_META } from '../../../lib/grooming/stages';
import { IAlert } from '../../../types/grooming';
import { cn } from '../../../utils';

export interface IToast {
  alert: IAlert;
  contactName: string;
  body: string;
}

const AUTO_HIDE_MS = 8000;

const ToastCard: React.FC<{
  toast: IToast;
  onClose: () => void;
  onView: () => void;
}> = ({ toast, onClose, onView }) => {
  const meta = STAGE_META[toast.alert.stage];
  const [paused, setPaused] = useState(false);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Hide after AUTO_HIDE_MS; hovering pauses the countdown so it can be read.
  const remaining = useRef(AUTO_HIDE_MS);
  useEffect(() => {
    if (paused) return undefined;
    const started = Date.now();
    const t = setTimeout(() => closeRef.current(), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current -= Date.now() - started;
    };
  }, [paused]);

  return (
    <div
      role="alert"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto w-full max-w-sm animate-[toast-in_0.35s_ease-out] overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl shadow-black/20 dark:border-red-900/60 dark:bg-[#242526]"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
          <i className="fas fa-shield-alt" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
            Message from {toast.contactName}
          </p>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug text-gray-900 dark:text-white">
            {meta.childMessage}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onView}
              className="rounded-lg bg-[#0866FF] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0756d8]"
            >
              View message
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-800 hover:bg-gray-300 dark:bg-[#3A3B3C] dark:text-gray-100 dark:hover:bg-[#4E4F50]"
            >
              OK
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 flex-shrink-0 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3A3B3C]"
        >
          <i className="fas fa-times" />
        </button>
      </div>
      {/* Countdown until the popup hides itself */}
      <div
        className={cn('h-1 origin-left', meta.bar)}
        style={{
          animation: `toast-timer ${AUTO_HIDE_MS}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </div>
  );
};

/** Popup alerts that slide down from the top and hide after a few seconds. */
const AlertToastStack: React.FC<{
  toasts: IToast[];
  onClose: (alertId: string) => void;
  onView: (toast: IToast) => void;
}> = ({ toasts, onClose, onView }) => (
  <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex flex-col items-center gap-2 px-4">
    {toasts.slice(-3).map((t) => (
      <ToastCard
        key={t.alert.id}
        toast={t}
        onClose={() => onClose(t.alert.id)}
        onView={() => onView(t)}
      />
    ))}
  </div>
);

export default AlertToastStack;
