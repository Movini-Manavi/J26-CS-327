import React, { useMemo, useState } from 'react';
import { shortTime } from '../../../lib/grooming/format';
import {
  IAlert,
  IContact,
  IMessageWithAnalysis,
} from '../../../types/grooming';
import { cn } from '../../../utils';
import { Avatar } from './common';

interface IProps {
  contacts: IContact[];
  messages: IMessageWithAnalysis[];
  alerts: IAlert[];
  selectedId: string | null;
  onSelect: (contactId: string) => void;
}

const ConversationList: React.FC<IProps> = ({
  contacts,
  messages,
  alerts,
  selectedId,
  onSelect,
}) => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return contacts
      .map((contact) => {
        const thread = messages.filter((m) => m.contact_id === contact.id);
        const last = thread[thread.length - 1];
        const flagged = alerts.some((a) => a.contact_id === contact.id);
        return { contact, last, flagged };
      })
      .filter(({ contact }) =>
        contact.name.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) =>
        (b.last?.created_at ?? b.contact.created_at).localeCompare(
          a.last?.created_at ?? a.contact.created_at,
        ),
      );
  }, [contacts, messages, alerts, query]);

  return (
    <aside className="flex h-full w-full flex-col border-r border-gray-200 bg-white md:w-[340px] dark:border-neutral-700 dark:bg-[#242526]">
      <div className="px-4 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Chats
          </h1>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#3A3B3C] dark:text-white dark:hover:bg-[#4E4F50]">
            <i className="fas fa-edit text-[14px]" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 dark:bg-[#3A3B3C]">
          <i className="fas fa-search text-[13px] text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Messenger"
            className="flex-1 bg-transparent text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white"
          />
        </div>
      </div>

      <div className="fb-scrollbar flex-1 overflow-y-auto px-2 pb-2">
        {rows.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No conversations yet. Create a contact in /chatadmin and send a
            message.
          </p>
        )}
        {rows.map(({ contact, last, flagged }) => {
          const active = contact.id === selectedId;
          return (
            <button
              key={contact.id}
              onClick={() => onSelect(contact.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left focus:outline-none',
                active
                  ? 'bg-[#EBF5FF] dark:bg-[#2D88FF]/20'
                  : 'hover:bg-gray-100 dark:hover:bg-[#3A3B3C]',
              )}
            >
              <Avatar name={contact.name} online />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">
                  {contact.name}
                </p>
                <div className="flex items-center gap-1 text-[13px] text-gray-500 dark:text-gray-400">
                  <p className="truncate">
                    {last
                      ? `${last.direction === 'outgoing' ? 'You: ' : ''}${
                          last.body
                        }`
                      : 'Say hi 👋'}
                  </p>
                  {last && (
                    <span className="flex-shrink-0">
                      · {shortTime(last.created_at)}
                    </span>
                  )}
                </div>
              </div>
              {flagged && (
                <span
                  title="Risky messages detected in this chat"
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-[11px] text-red-600 dark:bg-red-900/40 dark:text-red-400"
                >
                  <i className="fas fa-shield-alt" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default ConversationList;
