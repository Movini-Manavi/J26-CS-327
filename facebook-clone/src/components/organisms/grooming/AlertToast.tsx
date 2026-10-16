import React, { useEffect, useRef } from 'react';
import { STAGE_META } from '../../../lib/grooming/stages';
import { IAlert } from '../../../types/grooming';
import { cn } from '../../../utils';

export interface IToast {
  alert: IAlert;
  contactName: string;
  body: string;
}

const AUTO_HIDE_MS = 9000;

const ToastCard: React.FC<{
  toast: IToast;
  onClose: () => void;
  onView: () => void;
}> = ({ toast, onClose, onView }) => {
  const meta = STAGE_META[toast.alert.stage];

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="alert"
      className="pointer-events-auto w-full max-w-md animate-[toast-in_0.35s_ease-out] overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl shadow-black/20 dark:border-red-900/60 dark:bg-[#242526]"
    >
      <div className={cn('h-1 w-full', meta.bar)} />
      <div className="flex gap-3 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
          <i className="fas fa-shield-alt" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
            Be careful with {toast.contactName}
          </p>
          <p className="mt-0.5 text-[13px] text-gray-600 dark:text-gray-300">
            This message looks like{' '}
            <span className="font-semibold">{meta.label}</span>.{' '}
            {meta.description}
          </p>
          <p className="mt-2 truncate rounded-lg bg-gray-100 px-2 py-1 text-[13px] italic text-gray-700 dark:bg-[#3A3B3C] dark:text-gray-200">
            “{toast.body}”
          </p>
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">
            Your guardian has been notified. You can talk to a trusted adult any
            time.
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
              Dismiss
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
    </div>
  );
};

/** Popup alerts that slide down from the top of the page. */
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
