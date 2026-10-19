import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../../organisms/grooming/common';
import { shortTime } from '../../../lib/grooming/format';
import { useGroomingData } from '../../../lib/grooming/useGroomingData';
import { CHAT } from '../../../routes/routes';
import { IContact, IMessageWithAnalysis } from '../../../types/grooming';

const tabs = ['All', 'Unread'] as const;
type Tab = (typeof tabs)[number];

interface IRow {
  contact: IContact;
  last?: IMessageWithAnalysis;
  /** Last message is from the contact, so the user has not replied yet. */
  unread: boolean;
  flagged: boolean;
}

function ChatItem({ row, onOpen }: { row: IRow; onOpen: () => void }) {
  const { contact, last, unread, flagged } = row;
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#3A3B3C] focus:outline-none"
    >
      <Avatar name={contact.name} online />

      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-[15px] font-semibold text-white">
          {contact.name}
        </p>
        <div className="flex items-center gap-1">
          <p
            className={`truncate text-[13px] ${
              unread ? 'font-semibold text-white' : 'text-gray-400'
            }`}
          >
            {last
              ? `${last.direction === 'outgoing' ? 'You: ' : ''}${last.body}`
              : 'Say hi 👋'}
          </p>
          {last && (
            <span className="flex-shrink-0 text-[12px] text-gray-400">
              · {shortTime(last.created_at)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {flagged && (
          <span
            title="Unsafe messages were detected in this chat"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-red-900/40 text-[11px] text-red-400"
          >
            <i className="fas fa-shield-alt" />
          </span>
        )}
        {unread && <span className="h-3 w-3 rounded-full bg-[#0866FF]" />}
      </div>
    </button>
  );
}

const MessengerDropdown: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { contacts, messages, alerts, loading, error } = useGroomingData();

  const rows = useMemo<IRow[]>(
    () =>
      contacts
        .map((contact) => {
          const thread = messages.filter((m) => m.contact_id === contact.id);
          const last = thread[thread.length - 1];
          return {
            contact,
            last,
            unread: last?.direction === 'incoming',
            flagged: alerts.some((a) => a.contact_id === contact.id),
          };
        })
        .filter((r) => activeTab === 'All' || r.unread)
        .filter((r) =>
          r.contact.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          (b.last?.created_at ?? b.contact.created_at).localeCompare(
            a.last?.created_at ?? a.contact.created_at,
          ),
        ),
    [contacts, messages, alerts, activeTab, query],
  );

  const open = (path: string) => {
    navigate(path);
    onClose?.();
  };

  return (
    <div className="absolute right-0 top-12 w-[360px] rounded-2xl bg-[#242526] shadow-2xl shadow-black/60">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-2xl font-bold text-white">Chats</h2>
        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3A3B3C] text-white hover:bg-[#4E4F50] focus:outline-none">
            <i className="fas fa-th text-[14px]" />
          </button>
          <button
            onClick={() => open(CHAT)}
            title="Open Messenger"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3A3B3C] text-white hover:bg-[#4E4F50] focus:outline-none"
          >
            <i className="fas fa-expand-alt text-[14px]" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3A3B3C] text-white hover:bg-[#4E4F50] focus:outline-none">
            <i className="fas fa-edit text-[14px]" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-full bg-[#3A3B3C] px-3 py-2">
          <i className="fas fa-search text-[13px] text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Messenger"
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-1 text-[14px] font-medium focus:outline-none ${
              activeTab === tab
                ? 'bg-[#D8EAFF] text-[#0866FF]'
                : 'bg-[#3A3B3C] text-white hover:bg-[#4E4F50]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Chat list */}
      <div className="overflow-y-auto px-2" style={{ maxHeight: '60vh' }}>
        {loading && (
          <p className="px-3 py-6 text-center text-[14px] text-gray-400">
            <i className="fas fa-circle-notch fa-spin mr-2" />
            Loading chats…
          </p>
        )}
        {!loading && error && (
          <p className="px-3 py-6 text-center text-[14px] text-gray-400">
            Can&apos;t load chats: {error}
          </p>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="px-3 py-6 text-center text-[14px] text-gray-400">
            {contacts.length === 0 ? 'No chats yet' : 'No matching chats'}
          </p>
        )}
        {rows.map((row) => (
          <ChatItem
            key={row.contact.id}
            row={row}
            onOpen={() => open(`${CHAT}/${row.contact.id}`)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#3A3B3C] px-4 py-3 text-center">
        <button
          onClick={() => open(CHAT)}
          className="text-[15px] font-semibold text-[#0866FF] hover:underline focus:outline-none"
        >
          See all in Messenger
        </button>
      </div>
    </div>
  );
};

export default MessengerDropdown;
