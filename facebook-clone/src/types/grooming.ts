// Shapes mirror the grooming-backend tables so the mock and the real API
// return the same objects.

export const STAGES = [
  'none',
  'Trust-Building',
  'Isolation',
  'Desensitization',
  'Solicitation',
] as const;

export type StageLabel = (typeof STAGES)[number];

export type Direction = 'incoming' | 'outgoing';

export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';

export interface IContact {
  id: string;
  name: string;
  dob: string; // YYYY-MM-DD
  phone: string;
  created_at: string;
}

export interface INewContact {
  name: string;
  dob: string;
  phone: string;
}

export interface IMessage {
  id: string;
  contact_id: string;
  direction: Direction;
  body: string;
  seq: number;
  created_at: string;
}

export interface IAnalysis {
  message_id: string;
  normalized_text: string;
  label: StageLabel;
  scores: Record<StageLabel, number>;
  created_at: string;
}

/** A message plus its analysis (only incoming messages are analysed). */
export interface IMessageWithAnalysis extends IMessage {
  analysis?: IAnalysis | null;
}

export interface IAlert {
  id: string;
  contact_id: string;
  message_id: string;
  stage: StageLabel;
  level: AlertLevel;
  created_at: string;
  acknowledged: boolean;
}

export interface IPushSubscriptionInput {
  endpoint: string;
  keys: Record<string, string>;
}

/** Events pushed to the browser (WebSocket in the real backend). */
export type ServerEvent =
  | { type: 'message'; message: IMessageWithAnalysis; alert?: IAlert | null }
  | { type: 'contact'; contact: IContact }
  | { type: 'alert'; alert: IAlert }
  | { type: 'reset' };

export type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

/** Shared result format for integrating with the other three components. */
export interface IComponentResult {
  component: string;
  risk: AlertLevel | 'none';
  label: string;
  score: number;
  reason: string;
  message_id: string;
}
