import { AlertLevel, StageLabel } from '../../types/grooming';

interface IStageMeta {
  label: string;
  description: string;
  /** Tailwind classes for chips. */
  chip: string;
  /** Solid colour for bars. */
  bar: string;
  icon: string;
  /** Short popup text shown to the child in /chat. */
  childMessage: string;
  /** Text shown to guardians (the backend push uses the same wording). */
  guardianMessage: string;
}

export const STAGE_META: Record<StageLabel, IStageMeta> = {
  none: {
    label: 'No stage',
    description: 'No grooming pattern detected in this message.',
    chip: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300',
    bar: 'bg-gray-400',
    icon: 'fas fa-check-circle',
    childMessage: '',
    guardianMessage: '',
  },
  'Trust-Building': {
    label: 'Trust-Building',
    description:
      'Flattery, special attention or "you can tell me anything" style messages.',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    bar: 'bg-amber-500',
    icon: 'fas fa-handshake',
    childMessage: 'Be careful. Not everyone online is who they say they are.',
    guardianMessage:
      'Early warning sign: a message to your child tries to build a fast bond. Open the guardian page.',
  },
  Isolation: {
    label: 'Isolation',
    description:
      'Asking for secrecy or separating the user from parents and friends.',
    chip: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    bar: 'bg-orange-500',
    icon: 'fas fa-user-secret',
    childMessage: "Be careful. Don't keep secrets. Tell someone you trust.",
    guardianMessage:
      'Warning sign: a message asks your child to keep secrets or chat privately. Open the guardian page.',
  },
  Desensitization: {
    label: 'Desensitization',
    description:
      'Normalising inappropriate or personal topics to lower boundaries.',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    bar: 'bg-rose-500',
    icon: 'fas fa-exclamation-triangle',
    childMessage: "This message may not be okay. You don't have to reply.",
    guardianMessage:
      'Serious warning sign: a message steers your child toward inappropriate topics. Open the guardian page.',
  },
  Solicitation: {
    label: 'Solicitation',
    description: 'Requests for images, private calls or meeting in person.',
    chip: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    bar: 'bg-red-600',
    icon: 'fas fa-exclamation-circle',
    childMessage:
      "Don't send anything or agree to meet. Tell a trusted adult now.",
    guardianMessage:
      'Urgent: a message asks your child for photos, details or a meeting. Check in with your child now.',
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
