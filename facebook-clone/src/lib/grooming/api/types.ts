import {
  ConnectionState,
  IAlert,
  IContact,
  IMessageWithAnalysis,
  INewContact,
  IPushSubscriptionInput,
  ServerEvent,
} from '../../../types/grooming';

export interface IIncomingResult {
  message: IMessageWithAnalysis;
  alert: IAlert | null;
}

/**
 * Everything the pages need from the backend. Pages only use this interface,
 * so the in-browser mock can be swapped for the real FastAPI backend by
 * changing VITE_API_MODE.
 */
export interface IGroomingApi {
  readonly mode: 'mock' | 'http';

  listContacts(): Promise<IContact[]>;
  /** POST /contacts (needs the demo key) */
  addContact(input: INewContact, demoKey: string): Promise<IContact>;

  /** GET /messages?contact_id=&after=  (`after` is a message seq) */
  listMessages(params?: {
    contactId?: string;
    after?: number;
  }): Promise<IMessageWithAnalysis[]>;
  /** POST /messages/incoming, from /chatadmin (needs the demo key) */
  sendIncoming(
    contactId: string,
    body: string,
    demoKey: string,
  ): Promise<IIncomingResult>;
  /** POST /messages/outgoing, the demo user's reply from /chat */
  sendOutgoing(contactId: string, body: string): Promise<IMessageWithAnalysis>;

  /** GET /alerts */
  listAlerts(): Promise<IAlert[]>;
  /** POST /alerts/{id}/ack (not in the draft endpoint list yet) */
  acknowledgeAlert(alertId: string): Promise<IAlert>;

  /** POST /push/subscribe */
  subscribePush(subscription: IPushSubscriptionInput): Promise<void>;

  /**
   * Live updates (WS /ws, with GET polling as fallback).
   * Returns an unsubscribe function.
   */
  subscribe(
    onEvent: (event: ServerEvent) => void,
    onConnection?: (state: ConnectionState) => void,
  ): () => void;

  /** Mock only: wipe and reseed the demo data. */
  resetDemo?(): Promise<void>;
}
