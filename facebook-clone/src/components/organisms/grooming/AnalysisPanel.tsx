import React from 'react';
import { ageFromDob, shortId, shortTime } from '../../../lib/grooming/format';
import { STAGE_META } from '../../../lib/grooming/stages';
import {
  ConnectionState,
  IContact,
  IMessageWithAnalysis,
  STAGES,
} from '../../../types/grooming';
import { cn } from '../../../utils';
import { Avatar, ConnectionBadge, PrototypeNotice, StageBadge } from './common';

interface IProps {
  contact: IContact;
  messages: IMessageWithAnalysis[];
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
  connection: ConnectionState;
}

/** Right-hand panel: contact details, per-message analysis and stage timeline. */
const AnalysisPanel: React.FC<IProps> = ({
  contact,
  messages,
  selectedMessageId,
  onSelectMessage,
  connection,
}) => {
  const incoming = messages.filter((m) => m.direction === 'incoming');
  const selected =
    incoming.find((m) => m.id === selectedMessageId) ??
    incoming[incoming.length - 1];
  const flagged = incoming.filter(
    (m) => m.analysis && m.analysis.label !== 'none',
  );
  const age = ageFromDob(contact.dob);

  return (
    <aside className="fb-scrollbar hidden h-full w-[320px] flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white px-4 py-4 lg:block dark:border-neutral-700 dark:bg-[#242526]">
      <div className="flex flex-col items-center text-center">
        <Avatar name={contact.name} size="lg" />
        <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
          {contact.name}
        </p>
        <div className="mt-2">
          <ConnectionBadge state={connection} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-xl bg-gray-50 p-3 text-[13px] dark:bg-[#3A3B3C]/50">
        <dt className="text-gray-500 dark:text-gray-400">Contact ID</dt>
        <dd className="truncate font-mono text-gray-800 dark:text-gray-200">
          {shortId(contact.id)}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">DOB</dt>
        <dd className="text-gray-800 dark:text-gray-200">
          {contact.dob}
          {age !== null && ` (age ${age})`}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">Phone</dt>
        <dd className="text-gray-800 dark:text-gray-200">{contact.phone}</dd>
      </dl>

      <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Message analysis
      </h3>
      {!selected?.analysis ? (
        <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
          No analysed incoming message yet. Your own replies are stored but not
          classified.
        </p>
      ) : (
        <div className="mt-2 rounded-xl border border-gray-200 p-3 dark:border-neutral-700">
          <p className="text-[13px] text-gray-800 dark:text-gray-200">
            “{selected.body}”
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase text-gray-400">
            Normalized
          </p>
          <p className="font-mono text-[12px] text-gray-700 dark:text-gray-300">
            {selected.analysis.normalized_text}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <StageBadge stage={selected.analysis.label} />
            <span className="text-[11px] text-gray-400">
              {shortTime(selected.analysis.created_at)}
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {STAGES.map((s) => {
              const score = selected.analysis?.scores[s] ?? 0;
              return (
                <div key={s} className="text-[12px]">
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>{STAGE_META[s].label}</span>
                    <span className="font-mono">{score.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-neutral-700">
                    <div
                      className={cn('h-1.5 rounded-full', STAGE_META[s].bar)}
                      style={{ width: `${Math.round(score * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Stages seen in this chat
      </h3>
      {flagged.length === 0 ? (
        <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
          Nothing flagged so far.
        </p>
      ) : (
        <ol className="mt-2 space-y-2 border-l-2 border-gray-200 pl-3 dark:border-neutral-700">
          {flagged.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => onSelectMessage(m.id)}
                className="w-full rounded-lg p-1 text-left hover:bg-gray-50 dark:hover:bg-[#3A3B3C]"
              >
                <div className="flex items-center justify-between">
                  {m.analysis && <StageBadge stage={m.analysis.label} />}
                  <span className="text-[11px] text-gray-400">
                    {shortTime(m.created_at)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[12px] text-gray-600 dark:text-gray-300">
                  {m.body}
                </p>
              </button>
            </li>
          ))}
        </ol>
      )}

      <PrototypeNotice className="mt-6" />
    </aside>
  );
};

export default AnalysisPanel;
