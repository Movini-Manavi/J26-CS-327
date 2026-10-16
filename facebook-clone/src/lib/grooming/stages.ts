import { AlertLevel, StageLabel } from '../../types/grooming';

interface IStageMeta {
  label: string;
  description: string;
  /** Tailwind classes for chips. */
  chip: string;
  /** Solid colour for bars. */
  bar: string;
  icon: string;
}

export const STAGE_META: Record<StageLabel, IStageMeta> = {
  none: {
    label: 'No stage',
    description: 'No grooming pattern detected in this message.',
    chip: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300',
    bar: 'bg-gray-400',
    icon: 'fas fa-check-circle',
  },
  'Trust-Building': {
    label: 'Trust-Building',
    description:
      'Flattery, special attention or "you can tell me anything" style messages.',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    bar: 'bg-amber-500',
    icon: 'fas fa-handshake',
  },
  Isolation: {
    label: 'Isolation',
    description:
      'Asking for secrecy or separating the user from parents and friends.',
    chip: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    bar: 'bg-orange-500',
    icon: 'fas fa-user-secret',
  },
  Desensitization: {
    label: 'Desensitization',
    description:
      'Normalising inappropriate or personal topics to lower boundaries.',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    bar: 'bg-rose-500',
    icon: 'fas fa-exclamation-triangle',
  },
  Solicitation: {
    label: 'Solicitation',
    description: 'Requests for images, private calls or meeting in person.',
    chip: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    bar: 'bg-red-600',
    icon: 'fas fa-exclamation-circle',
  },
};

export const LEVEL_META: Record<AlertLevel, { label: string; chip: string }> = {
  low: {
    label: 'Low',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  medium: {
    label: 'Medium',
    chip: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  },
  high: {
    label: 'High',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  },
  critical: {
    label: 'Critical',
    chip: 'bg-red-600 text-white',
  },
};
