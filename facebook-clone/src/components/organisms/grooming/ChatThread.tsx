import moment from 'moment';
import React, { useEffect, useRef, useState } from 'react';
import { IContact, IMessageWithAnalysis } from '../../../types/grooming';
import { cn } from '../../../utils';
import { Avatar, StageBadge } from './common';

interface IProps {
  contact: IContact;
  messages: IMessageWithAnalysis[];
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
  onSend: (body: string) => Promise<void>;
  showAnalysis: boolean;
  onToggleAnalysis: () => void;
  onBack: () => void;
}

const ChatThread: React.FC<IProps> = ({
  contact,
  messages,
  selectedMessageId,
  onSelectMessage,
  onSend,
  showAnalysis,
  onToggleAnalysis,
  onBack,
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, contact.id]);

  useEffect(() => {
    if (selectedMessageId) {
      messageRefs.current[selectedMessageId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedMessageId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setDraft('');
    } catch {
      // The page shows the error; keep the draft so it can be resent.
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-white dark:bg-[#242526]">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-200 px-3 py-2 shadow-sm dark:border-neutral-700">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#0866FF] hover:bg-gray-100 md:hidden dark:hover:bg-[#3A3B3C]"
          aria-label="Back to chats"
        >
          <i className="fas fa-arrow-left" />
        </button>
        <Avatar name={contact.name} online size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">
            {contact.name}
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            Active now
          </p>
        </div>
        <div className="flex items-center gap-1 text-[#0866FF]">
          <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#3A3B3C]">
            <i className="fas fa-phone-alt" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#3A3B3C]">
            <i className="fas fa-video" />
          </button>
          <button
            onClick={onToggleAnalysis}
            title="Toggle safety analysis panel"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#3A3B3C]',
              showAnalysis && 'bg-[#EBF5FF] dark:bg-[#2D88FF]/20',
            )}
          >
            <i className="fas fa-info-circle" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="fb-scrollbar flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-6 flex flex-col items-center text-center">
          <Avatar name={contact.name} size="lg" />
          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
            {contact.name}
          </p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            You&apos;re connected on Messenger
          </p>
        </div>

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showTime =
            !prev ||
            moment(m.created_at).diff(moment(prev.created_at), 'minutes') > 20;
          const incoming = m.direction === 'incoming';
          const stage = m.analysis?.label;
          const flagged = incoming && stage && stage !== 'none';
          const selected = m.id === selectedMessageId;
          return (
            <div
              key={m.id}
              ref={(el) => {
                messageRefs.current[m.id] = el;
              }}
            >
              {showTime && (
                <p className="my-3 text-center text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {moment(m.created_at).calendar()}
                </p>
              )}
              <div
                className={cn(
                  'mb-1 flex items-end gap-2',
                  incoming ? 'justify-start' : 'justify-end',
                )}
              >
                {incoming && <Avatar name={contact.name} size="sm" />}
                <div
                  className={cn(
                    'flex max-w-[70%] flex-col',
                    incoming ? 'items-start' : 'items-end',
                  )}
                >
                  <button
                    type="button"
                    disabled={!incoming}
                    onClick={() => onSelectMessage(m.id)}
                    title={incoming ? 'Show analysis' : undefined}
                    className={cn(
                      'whitespace-pre-wrap break-words rounded-[18px] px-3 py-2 text-left text-[15px] leading-snug',
                      incoming
                        ? 'bg-gray-100 text-gray-900 dark:bg-[#3A3B3C] dark:text-gray-100'
                        : 'cursor-default bg-[#0866FF] text-white',
                      flagged &&
                        'ring-2 ring-red-400/80 ring-offset-1 ring-offset-white dark:ring-red-500/70 dark:ring-offset-[#242526]',
                      selected && 'outline outline-2 outline-[#0866FF]/60',
                    )}
                  >
                    {m.body}
                  </button>
                  {incoming && !m.analysis && (
                    <span className="mt-1 text-[11px] text-gray-400">
                      <i className="fas fa-circle-notch fa-spin mr-1" />
                      analysing…
                    </span>
                  )}
                  {flagged && stage && (
                    <StageBadge stage={stage} className="mt-1" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-gray-200 px-3 py-2 dark:border-neutral-700"
      >
        <div className="flex items-center gap-1 text-[#0866FF]">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#3A3B3C]"
          >
            <i className="fas fa-plus-circle text-lg" />
          </button>
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 sm:flex dark:hover:bg-[#3A3B3C]"
          >
            <i className="fas fa-image text-lg" />
          </button>
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Aa"
          className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-[15px] text-gray-900 placeholder:text-gray-500 focus:outline-none dark:bg-[#3A3B3C] dark:text-white dark:placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#0866FF] hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-[#3A3B3C]"
          aria-label="Send"
        >
          <i
            className={
              sending ? 'fas fa-circle-notch fa-spin' : 'fas fa-paper-plane'
            }
          />
        </button>
      </form>
    </section>
  );
};

export default ChatThread;
