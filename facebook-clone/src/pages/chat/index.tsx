import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AlertToastStack, {
  IToast,
} from '../../components/organisms/grooming/AlertToast';
import ChatThread from '../../components/organisms/grooming/ChatThread';
import ConversationList from '../../components/organisms/grooming/ConversationList';
import { useGroomingData } from '../../lib/grooming/useGroomingData';
import { ServerEvent } from '../../types/grooming';
import { CHAT } from '../../routes/routes';
import { cn } from '../../utils';

const ChatPage: React.FC = () => {
  // The open chat lives in the URL (/chat/:contactId) so other pages can link to it.
  const { contactId } = useParams();
  const navigate = useNavigate();
  const selectedContactId = contactId ?? null;
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [mobileThreadOpen, setMobileThreadOpen] = useState(!!contactId);
  const [toasts, setToasts] = useState<IToast[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleEvent = useCallback((event: ServerEvent) => {
    if (
      event.type === 'message' &&
      event.alert &&
      event.message.direction === 'incoming'
    ) {
      const alert = event.alert;
      const body = event.message.body;
      setToasts((prev) => [
        ...prev.filter((t) => t.alert.id !== alert.id),
        // contactName is filled in at render time from the contact list.
        { alert, body, contactName: '' },
      ]);
    }
  }, []);

  const { contacts, messages, alerts, loading, error, api } =
    useGroomingData(handleEvent);

  useEffect(() => {
    document.title = 'Messenger | Facebook Clone';
  }, []);

  // With no chat in the URL (or an unknown one), open the most recent one.
  useEffect(() => {
    if (loading || contacts.length === 0) return;
    if (selectedContactId && contacts.some((c) => c.id === selectedContactId)) {
      return;
    }
    const latest = [...messages].sort((a, b) => b.seq - a.seq)[0];
    navigate(`${CHAT}/${latest?.contact_id ?? contacts[0].id}`, {
      replace: true,
    });
  }, [loading, contacts, messages, selectedContactId, navigate]);

  const contact = contacts.find((c) => c.id === selectedContactId) ?? null;
  const thread = useMemo(
    () => messages.filter((m) => m.contact_id === selectedContactId),
    [messages, selectedContactId],
  );

  const namedToasts = toasts.map((t) => ({
    ...t,
    contactName:
      contacts.find((c) => c.id === t.alert.contact_id)?.name ?? 'this contact',
  }));

  const closeToast = useCallback((alertId: string) => {
    setToasts((prev) => prev.filter((t) => t.alert.id !== alertId));
  }, []);

  const selectContact = (id: string) => {
    navigate(`${CHAT}/${id}`);
    setSelectedMessageId(null);
    setMobileThreadOpen(true);
  };

  const send = async (body: string) => {
    if (!contact) return;
    setSendError(null);
    try {
      await api.sendOutgoing(contact.id, body);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Could not send');
      throw e;
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-[#18191A]">
      <AlertToastStack
        toasts={namedToasts}
        onClose={closeToast}
        onView={(t) => {
          navigate(`${CHAT}/${t.alert.contact_id}`);
          setSelectedMessageId(t.alert.message_id);
          setMobileThreadOpen(true);
          closeToast(t.alert.id);
        }}
      />

      <div
        className={cn(
          'h-full w-full md:block md:w-auto',
          mobileThreadOpen ? 'hidden' : 'block',
        )}
      >
        <ConversationList
          contacts={contacts}
          messages={messages}
          alerts={alerts}
          selectedId={selectedContactId}
          onSelect={selectContact}
        />
      </div>

      <div
        className={cn(
          'h-full min-w-0 flex-1 md:flex',
          mobileThreadOpen ? 'flex' : 'hidden',
        )}
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            <i className="fas fa-circle-notch fa-spin mr-2" /> Loading chats…
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-gray-600 dark:text-gray-300">
            <i className="fas fa-plug text-3xl text-gray-400" />
            <p className="font-semibold">Can&apos;t reach the backend</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        ) : contact ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col">
              {sendError && (
                <p className="bg-red-50 px-4 py-1 text-[13px] text-red-600 dark:bg-red-900/30 dark:text-red-300">
                  {sendError}
                </p>
              )}
              <ChatThread
                contact={contact}
                messages={thread}
                selectedMessageId={selectedMessageId}
                onSend={send}
                onBack={() => setMobileThreadOpen(false)}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500 dark:text-gray-400">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
