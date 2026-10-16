import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  IAlert,
  IContact,
  IMessageWithAnalysis,
  ServerEvent,
} from '../../types/grooming';
import { groomingApi } from './api';

function upsert<T>(list: T[], item: T, key: (x: T) => string): T[] {
  const i = list.findIndex((x) => key(x) === key(item));
  if (i === -1) return [...list, item];
  const next = [...list];
  next[i] = item;
  return next;
}

/**
 * Loads contacts, messages and alerts, then keeps them in sync with live
 * events. `onEvent` lets a page react to an event (e.g. show a popup).
 */
export function useGroomingData(onEvent?: (event: ServerEvent) => void) {
  const [contacts, setContacts] = useState<IContact[]>([]);
  const [messages, setMessages] = useState<IMessageWithAnalysis[]>([]);
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const reload = useCallback(async () => {
    try {
      const [c, m, a] = await Promise.all([
        groomingApi.listContacts(),
        groomingApi.listMessages(),
        groomingApi.listAlerts(),
      ]);
      setContacts(c);
      setMessages(m);
      setAlerts(a);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return groomingApi.subscribe((event) => {
      switch (event.type) {
        case 'message':
          setMessages((prev) =>
            upsert(prev, event.message, (m) => m.id).sort(
              (a, b) => a.seq - b.seq,
            ),
          );
          if (event.alert) {
            const alert = event.alert;
            setAlerts((prev) => upsert(prev, alert, (a) => a.id));
          }
          break;
        case 'contact':
          setContacts((prev) => upsert(prev, event.contact, (c) => c.id));
          break;
        case 'alert':
          setAlerts((prev) => upsert(prev, event.alert, (a) => a.id));
          break;
        case 'reset':
          reload();
          break;
        default:
      }
      onEventRef.current?.(event);
    }, setConnection);
  }, [reload]);

  return {
    contacts,
    messages,
    alerts,
    connection,
    loading,
    error,
    reload,
    api: groomingApi,
  };
}
