import {
  ConnectionState,
  IAlert,
  IContact,
  IMessageWithAnalysis,
  ServerEvent,
} from '../../../types/grooming';
import { API_URL, POLL_INTERVAL_MS } from '../config';
import { IGroomingApi, IIncomingResult } from './types';

/*
 * Client for grooming-backend (FastAPI). Not used until VITE_API_MODE=http.
 * Live updates come from WS /ws; if the socket drops, it polls
 * GET /messages?after=<seq> and GET /alerts until the socket reconnects.
 */

async function request<T>(
  path: string,
  init: RequestInit & { demoKey?: string } = {},
): Promise<T> {
  const { demoKey, headers, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(demoKey ? { 'X-Demo-Key': demoKey } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export function createHttpApi(): IGroomingApi {
  return {
    mode: 'http',

    listContacts: () => request<IContact[]>('/contacts'),

    addContact: (input, demoKey) =>
      request<IContact>('/contacts', {
        method: 'POST',
        body: JSON.stringify(input),
        demoKey,
      }),

    listMessages: (params = {}) => {
      const q = new URLSearchParams();
      if (params.contactId) q.set('contact_id', params.contactId);
      if (params.after !== undefined) q.set('after', String(params.after));
      const qs = q.toString();
      return request<IMessageWithAnalysis[]>(`/messages${qs ? `?${qs}` : ''}`);
    },

    sendIncoming: (contactId, body, demoKey) =>
      request<IIncomingResult>('/messages/incoming', {
        method: 'POST',
        body: JSON.stringify({ contact_id: contactId, body }),
        demoKey,
      }),

    sendOutgoing: (contactId, body) =>
      request<IMessageWithAnalysis>('/messages/outgoing', {
        method: 'POST',
        body: JSON.stringify({ contact_id: contactId, body }),
      }),

    listAlerts: () => request<IAlert[]>('/alerts'),

    acknowledgeAlert: (alertId) =>
      request<IAlert>(`/alerts/${alertId}/ack`, { method: 'POST' }),

    subscribePush: (subscription) =>
      request<void>('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
      }),

    subscribe(onEvent, onConnection) {
      let ws: WebSocket | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let retries = 0;
      let closed = false;
      let lastSeq = 0;
      const seenAlerts = new Set<string>();

      const setState = (s: ConnectionState) => onConnection?.(s);

      const handle = (event: ServerEvent) => {
        if (event.type === 'message') {
          lastSeq = Math.max(lastSeq, event.message.seq);
          if (event.alert) seenAlerts.add(event.alert.id);
        }
        if (event.type === 'alert') seenAlerts.add(event.alert.id);
        onEvent(event);
      };

      const poll = async () => {
        try {
          const [messages, alerts] = await Promise.all([
            createHttpApi().listMessages({ after: lastSeq }),
            request<IAlert[]>('/alerts'),
          ]);
          messages.forEach((message) => {
            const alert =
              alerts.find(
                (a) => a.message_id === message.id && !seenAlerts.has(a.id),
              ) ?? null;
            handle({ type: 'message', message, alert });
          });
          alerts
            .filter((a) => !seenAlerts.has(a.id))
            .forEach((alert) => handle({ type: 'alert', alert }));
          setState('polling');
        } catch {
          setState('offline');
        }
      };

      const startPolling = () => {
        if (pollTimer) return;
        setState('polling');
        poll();
        pollTimer = setInterval(poll, POLL_INTERVAL_MS);
      };

      const stopPolling = () => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
      };

      const connect = () => {
        if (closed) return;
        setState('connecting');
        try {
          ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws`);
        } catch {
          startPolling();
          return;
        }
        ws.onopen = () => {
          retries = 0;
          stopPolling();
          setState('live');
        };
        ws.onmessage = (ev) => {
          try {
            handle(JSON.parse(ev.data) as ServerEvent);
          } catch {}
        };
        ws.onclose = () => {
          if (closed) return;
          startPolling();
          retries += 1;
          retryTimer = setTimeout(
            connect,
            Math.min(30000, 1000 * 2 ** retries),
          );
        };
      };

      // Prime lastSeq so polling does not replay old messages.
      createHttpApi()
        .listMessages()
        .then((all) => {
          all.forEach((m) => (lastSeq = Math.max(lastSeq, m.seq)));
        })
        .catch(() => undefined);
      request<IAlert[]>('/alerts')
        .then((all) => all.forEach((a) => seenAlerts.add(a.id)))
        .catch(() => undefined);

      connect();

      return () => {
        closed = true;
        stopPolling();
        if (retryTimer) clearTimeout(retryTimer);
        ws?.close();
      };
    },
  };
}
