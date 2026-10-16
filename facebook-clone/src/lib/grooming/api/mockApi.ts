import {
  ConnectionState,
  IAlert,
  IAnalysis,
  IContact,
  IMessage,
  IMessageWithAnalysis,
  INewContact,
  IPushSubscriptionInput,
  ServerEvent,
} from '../../../types/grooming';
import { ALERT_STAGES, DEMO_KEY, STAGE_LEVEL } from '../config';
import { uuid } from '../uuid';
import { mockClassify, mockNormalize } from './mockClassifier';
import { IGroomingApi, IIncomingResult } from './types';

/*
 * In-browser stand-in for grooming-backend. Data lives in localStorage and
 * events are shared between tabs with BroadcastChannel, so /chatadmin in one
 * tab updates /chat and /guardian in another, the same way the WebSocket will.
 */

const STORAGE_KEY = 'grooming-demo-v1';
const CHANNEL_NAME = 'grooming-demo';

interface IMockDb {
  contacts: IContact[];
  messages: IMessage[];
  analysis: IAnalysis[];
  alerts: IAlert[];
  subscriptions: (IPushSubscriptionInput & {
    id: string;
    created_at: string;
  })[];
  seq: number;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function emptyDb(): IMockDb {
  return {
    contacts: [],
    messages: [],
    analysis: [],
    alerts: [],
    subscriptions: [],
    seq: 0,
  };
}

function load(): IMockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {}
  const db = seed();
  save(db);
  return db;
}

function save(db: IMockDb) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {}
}

/** Store one message (and analyse it if incoming). Mirrors the backend flow. */
function storeMessage(
  db: IMockDb,
  contactId: string,
  direction: IMessage['direction'],
  body: string,
  at = new Date(),
): IIncomingResult {
  db.seq += 1;
  const message: IMessage = {
    id: uuid(),
    contact_id: contactId,
    direction,
    body,
    seq: db.seq,
    created_at: at.toISOString(),
  };
  db.messages.push(message);

  if (direction === 'outgoing') {
    return { message: { ...message, analysis: null }, alert: null };
  }

  const normalized = mockNormalize(body);
  const { label, scores } = mockClassify(normalized);
  const analysis: IAnalysis = {
    message_id: message.id,
    normalized_text: normalized,
    label,
    scores,
    created_at: at.toISOString(),
  };
  db.analysis.push(analysis);

  let alert: IAlert | null = null;
  const level = STAGE_LEVEL[label];
  if (ALERT_STAGES.includes(label) && level) {
    alert = {
      id: uuid(),
      contact_id: contactId,
      message_id: message.id,
      stage: label,
      level,
      created_at: at.toISOString(),
      acknowledged: false,
    };
    db.alerts.push(alert);
  }
  return { message: { ...message, analysis }, alert };
}

/** Fictional contacts and made-up messages so the pages are not empty. */
function seed(): IMockDb {
  const db = emptyDb();
  const now = Date.now();
  const mins = (m: number) => new Date(now - m * 60000);

  const sam: IContact = {
    id: uuid(),
    name: 'Sam Fernando',
    dob: '2011-04-12',
    phone: '+94 77 000 0001',
    created_at: mins(600).toISOString(),
  };
  const jay: IContact = {
    id: uuid(),
    name: 'Jay (gamer_jay)',
    dob: '1990-09-03',
    phone: '+94 71 000 0002',
    created_at: mins(500).toISOString(),
  };
  db.contacts.push(sam, jay);

  storeMessage(
    db,
    sam.id,
    'incoming',
    'hey did you finish the maths homework?',
    mins(240),
  );
  storeMessage(db, sam.id, 'outgoing', 'almost, question 5 is hard', mins(238));
  storeMessage(db, sam.id, 'incoming', 'same lol, see you tomorrow', mins(236));

  storeMessage(db, jay.id, 'incoming', 'gg that last match was sick', mins(90));
  storeMessage(db, jay.id, 'outgoing', 'haha thanks', mins(88));
  storeMessage(
    db,
    jay.id,
    'incoming',
    "you're so mature for your age, you can tell me anything",
    mins(60),
  );
  storeMessage(db, jay.id, 'outgoing', 'ok', mins(58));
  storeMessage(
    db,
    jay.id,
    'incoming',
    "don't tell your parents we talk, it's our little secret",
    mins(30),
  );

  // Seeded alerts start acknowledged so only new ones pop up.
  db.alerts.forEach((a) => {
    a.acknowledged = a.stage === 'Trust-Building';
  });
  return db;
}

function withAnalysis(db: IMockDb, m: IMessage): IMessageWithAnalysis {
  return {
    ...m,
    analysis: db.analysis.find((a) => a.message_id === m.id) ?? null,
  };
}

export function createMockApi(): IGroomingApi {
  const listeners = new Set<(e: ServerEvent) => void>();
  const channel =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;

  if (channel) {
    channel.onmessage = (ev: MessageEvent<ServerEvent>) => {
      listeners.forEach((l) => l(ev.data));
    };
  }

  const emit = (event: ServerEvent) => {
    listeners.forEach((l) => l(event));
    channel?.postMessage(event);
  };

  const checkKey = (key: string) => {
    if (key !== DEMO_KEY) throw new Error('Invalid demo key');
  };

  return {
    mode: 'mock',

    async listContacts() {
      return load().contacts;
    },

    async addContact(input: INewContact, demoKey: string) {
      checkKey(demoKey);
      const db = load();
      const contact: IContact = {
        id: uuid(),
        name: input.name.trim(),
        dob: input.dob,
        phone: input.phone.trim(),
        created_at: new Date().toISOString(),
      };
      db.contacts.push(contact);
      save(db);
      emit({ type: 'contact', contact });
      return contact;
    },

    async listMessages(params = {}) {
      const db = load();
      return db.messages
        .filter(
          (m) =>
            (!params.contactId || m.contact_id === params.contactId) &&
            (params.after === undefined || m.seq > params.after),
        )
        .sort((a, b) => a.seq - b.seq)
        .map((m) => withAnalysis(db, m));
    },

    async sendIncoming(contactId, body, demoKey) {
      checkKey(demoKey);
      // Pretend the model takes a moment on CPU.
      await delay(250 + Math.random() * 350);
      const db = load();
      if (!db.contacts.some((c) => c.id === contactId)) {
        throw new Error('Unknown contact');
      }
      const result = storeMessage(db, contactId, 'incoming', body);
      save(db);
      emit({ type: 'message', message: result.message, alert: result.alert });
      return result;
    },

    async sendOutgoing(contactId, body) {
      const db = load();
      const { message } = storeMessage(db, contactId, 'outgoing', body);
      save(db);
      emit({ type: 'message', message });
      return message;
    },

    async listAlerts() {
      return [...load().alerts].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    },

    async acknowledgeAlert(alertId) {
      const db = load();
      const alert = db.alerts.find((a) => a.id === alertId);
      if (!alert) throw new Error('Unknown alert');
      alert.acknowledged = true;
      save(db);
      emit({ type: 'alert', alert });
      return alert;
    },

    async subscribePush(subscription) {
      const db = load();
      db.subscriptions = db.subscriptions.filter(
        (s) => s.endpoint !== subscription.endpoint,
      );
      db.subscriptions.push({
        ...subscription,
        id: uuid(),
        created_at: new Date().toISOString(),
      });
      save(db);
    },

    subscribe(onEvent, onConnection?: (s: ConnectionState) => void) {
      listeners.add(onEvent);
      onConnection?.('live');
      return () => {
        listeners.delete(onEvent);
      };
    },

    async resetDemo() {
      const db = seed();
      save(db);
      emit({ type: 'reset' });
    },
  };
}
