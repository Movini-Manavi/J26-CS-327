import { AlertLevel, StageLabel } from '../../types/grooming';

const env = import.meta.env;

/** 'mock' runs everything in the browser; 'http' talks to grooming-backend. */
export const API_MODE: 'mock' | 'http' =
  env.VITE_API_MODE === 'http' ? 'http' : 'mock';

export const API_URL: string = (
  env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/$/, '');

/** Shared key that protects /chatadmin. The real backend checks it too. */
export const DEMO_KEY: string = env.VITE_DEMO_KEY || 'demo-key';

export const VAPID_PUBLIC_KEY: string = env.VITE_VAPID_PUBLIC_KEY || '';

export const POLL_INTERVAL_MS = 3000;

/** The one fixed demo user who receives the messages. */
export const DEMO_USER = {
  name: 'Alex Perera',
  label: 'Demo user (fictional)',
};

/**
 * Alert rule used by the mock backend. The real rule lives in the backend
 * config; this mirrors the current rule: alert on any stage message.
 */
export const ALERT_STAGES: StageLabel[] = [
  'Trust-Building',
  'Isolation',
  'Desensitization',
  'Solicitation',
];

export const STAGE_LEVEL: Record<StageLabel, AlertLevel | null> = {
  none: null,
  'Trust-Building': 'low',
  Isolation: 'medium',
  Desensitization: 'high',
  Solicitation: 'critical',
};
