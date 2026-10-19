import moment from 'moment';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Avatar,
  ConnectionBadge,
  PrototypeNotice,
  StageBadge,
} from '../../components/organisms/grooming/common';
import { API_MODE, DEMO_USER } from '../../lib/grooming/config';
import { ageFromDob } from '../../lib/grooming/format';
import {
  enablePush,
  getPushStatus,
  PushStatus,
  showLocalNotification,
} from '../../lib/grooming/push';
import { LEVEL_META, STAGE_META } from '../../lib/grooming/stages';
import { useGroomingData } from '../../lib/grooming/useGroomingData';
import { useNoIndex } from '../../lib/grooming/useNoIndex';
import { ServerEvent, STAGES, StageLabel } from '../../types/grooming';
import { cn } from '../../utils';

const ALERT_STAGES = STAGES.filter((s) => s !== 'none');

const PUSH_COPY: Record<PushStatus, { title: string; text: string }> = {
  unsupported: {
    title: 'Notifications not supported',
    text: 'This browser cannot show notifications. Keep this page open to see new alerts.',
  },
  'needs-home-screen': {
    title: 'Add to Home Screen first',
    text: 'On iPhone (iOS 16.4+), tap Share → Add to Home Screen, open the app from there, then enable notifications.',
  },
  default: {
    title: 'Get notified about new alerts',
    text: 'Turn on notifications to hear about risky messages even when this page is in the background.',
  },
  granted: {
    title: 'Notifications are on',
    text: 'You will be notified when a new alert is raised.',
  },
  denied: {
    title: 'Notifications are blocked',
    text: 'Allow notifications for this site in your browser settings, then reload.',
  },
};

const GuardianPage: React.FC = () => {
  useNoIndex('Guardian alerts (demo)');

  const [pushStatus, setPushStatus] = useState<PushStatus>(getPushStatus);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<StageLabel | 'all'>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { contacts, messages, alerts, connection, loading, error, api } =
    useGroomingData(
      useCallback((event: ServerEvent) => {
        // With the real backend, Web Push handles this via the service worker.
        if (API_MODE === 'mock' && event.type === 'message' && event.alert) {
          showLocalNotification(
            'Guardian alert',
            STAGE_META[event.alert.stage].guardianMessage,
          );
        }
      }, []),
    );

  const contactName = (id: string) =>
    contacts.find((c) => c.id === id)?.name ?? 'Unknown contact';

  const sorted = useMemo(
    () =>
      [...alerts]
        .filter((a) => stageFilter === 'all' || a.stage === stageFilter)
        .filter((a) => showAcknowledged || !a.acknowledged)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [alerts, stageFilter, showAcknowledged],
  );

  const unacknowledged = alerts.filter((a) => !a.acknowledged).length;
  const contactsFlagged = new Set(alerts.map((a) => a.contact_id)).size;

  const turnOnPush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      setPushStatus(await enablePush());
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Could not subscribe');
    } finally {
      setPushBusy(false);
    }
  };

  const copy = PUSH_COPY[pushStatus];

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#18191A]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-neutral-700 dark:bg-[#242526]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
            <i className="fas fa-shield-alt" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-gray-900 dark:text-white">
              Guardian alerts
            </h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              Monitoring {DEMO_USER.name}&apos;s Messenger (
              {DEMO_USER.label.toLowerCase()})
            </p>
          </div>
          <ConnectionBadge state={connection} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        {/* Notifications card */}
        <section
          className={cn(
            'flex flex-col gap-3 rounded-2xl p-4 shadow-sm sm:flex-row sm:items-center',
            pushStatus === 'granted'
              ? 'bg-emerald-50 dark:bg-emerald-900/20'
              : 'bg-white dark:bg-[#242526]',
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
              pushStatus === 'granted'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#0866FF]/10 text-[#0866FF]',
            )}
          >
            <i
              className={
                pushStatus === 'granted' ? 'fas fa-bell' : 'fas fa-bell-slash'
              }
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">
              {copy.title}
            </p>
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              {copy.text}
            </p>
            {pushError && (
              <p className="mt-1 text-[13px] text-red-500">{pushError}</p>
            )}
          </div>
          {pushStatus === 'default' && (
            <button
              onClick={turnOnPush}
              disabled={pushBusy}
              className="rounded-lg bg-[#0866FF] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#0756d8] disabled:opacity-60"
            >
              {pushBusy ? 'Enabling…' : 'Enable notifications'}
            </button>
          )}
        </section>

        {/* Summary */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: 'Unacknowledged',
              value: unacknowledged,
              icon: 'fas fa-exclamation-circle',
              tone: 'text-red-600',
            },
            {
              label: 'Total alerts',
              value: alerts.length,
              icon: 'fas fa-list',
              tone: 'text-gray-700 dark:text-gray-200',
            },
            {
              label: 'Contacts flagged',
              value: contactsFlagged,
              icon: 'fas fa-user-shield',
              tone: 'text-orange-600',
            },
            {
              label: 'Contacts',
              value: contacts.length,
              icon: 'fas fa-users',
              tone: 'text-gray-700 dark:text-gray-200',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#242526]"
            >
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                <i className={cn(s.icon, 'mr-1.5')} />
                {s.label}
              </p>
              <p className={cn('mt-1 text-2xl font-bold', s.tone)}>{s.value}</p>
            </div>
          ))}
        </section>

        {/* Stage breakdown */}
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#242526]">
          <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
            Alerts by grooming stage
          </h2>
          <div className="space-y-2">
            {ALERT_STAGES.map((s) => {
              const n = alerts.filter((a) => a.stage === s).length;
              const pct = alerts.length ? (n / alerts.length) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3 text-[13px]">
                  <span className="w-32 flex-shrink-0 text-gray-700 dark:text-gray-300">
                    {STAGE_META[s].label}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-neutral-700">
                    <div
                      className={cn('h-2 rounded-full', STAGE_META[s].bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-gray-600 dark:text-gray-300">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Alert list */}
        <section className="rounded-2xl bg-white shadow-sm dark:bg-[#242526]">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-4 dark:border-neutral-700">
            <h2 className="flex-1 font-semibold text-gray-900 dark:text-white">
              Alert history
            </h2>
            <select
              value={stageFilter}
              onChange={(e) =>
                setStageFilter(e.target.value as StageLabel | 'all')
              }
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-[13px] text-gray-800 dark:border-neutral-600 dark:bg-[#3A3B3C] dark:text-gray-100"
            >
              <option value="all">All stages</option>
              {ALERT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showAcknowledged}
                onChange={(e) => setShowAcknowledged(e.target.checked)}
              />
              Show acknowledged
            </label>
          </div>

          {loading && (
            <p className="p-6 text-center text-gray-500">
              <i className="fas fa-circle-notch fa-spin mr-2" />
              Loading alerts…
            </p>
          )}
          {error && (
            <p className="p-6 text-center text-red-500">
              Can&apos;t reach the backend: {error}
            </p>
          )}
          {!loading && !error && sorted.length === 0 && (
            <p className="p-8 text-center text-gray-500 dark:text-gray-400">
              <i className="fas fa-check-circle mb-2 block text-3xl text-emerald-500" />
              No alerts to show.
            </p>
          )}

          <ul className="divide-y divide-gray-100 dark:divide-neutral-700">
            {sorted.map((a) => {
              const msg = messages.find((m) => m.id === a.message_id);
              const contact = contacts.find((c) => c.id === a.contact_id);
              const age = contact ? ageFromDob(contact.dob) : null;
              const open = expanded === a.id;
              const context = msg
                ? messages
                    .filter(
                      (m) => m.contact_id === a.contact_id && m.seq <= msg.seq,
                    )
                    .slice(-4)
                : [];
              return (
                <li
                  key={a.id}
                  className={cn(
                    'p-4',
                    !a.acknowledged && 'bg-red-50/60 dark:bg-red-900/10',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={contactName(a.contact_id)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {contactName(a.contact_id)}
                        </span>
                        {age !== null && (
                          <span className="text-[12px] text-gray-500">
                            (age {age})
                          </span>
                        )}
                        <StageBadge stage={a.stage} />
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            LEVEL_META[a.level].chip,
                          )}
                        >
                          {LEVEL_META[a.level].label}
                        </span>
                        {!a.acknowledged && (
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      <p className="mt-1 text-[14px] font-medium text-gray-900 dark:text-white">
                        {STAGE_META[a.stage].guardianMessage}
                      </p>
                      <p className="mt-1 text-[13px] italic text-gray-600 dark:text-gray-300">
                        “{msg?.body ?? 'Message not loaded'}”
                      </p>
                      <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                        {moment(a.created_at).format('MMM D, h:mm A')} ·{' '}
                        {moment(a.created_at).fromNow()}
                      </p>

                      {open && (
                        <div className="mt-3 space-y-1 rounded-xl bg-gray-50 p-3 dark:bg-[#3A3B3C]/50">
                          <p className="text-[11px] font-semibold uppercase text-gray-400">
                            Conversation context
                          </p>
                          {context.map((m) => (
                            <p
                              key={m.id}
                              className={cn(
                                'text-[13px]',
                                m.id === a.message_id
                                  ? 'font-semibold text-gray-900 dark:text-white'
                                  : 'text-gray-600 dark:text-gray-300',
                              )}
                            >
                              <span className="text-gray-400">
                                {m.direction === 'incoming'
                                  ? contactName(m.contact_id)
                                  : DEMO_USER.name}
                                :
                              </span>{' '}
                              {m.body}
                            </p>
                          ))}
                          <p className="pt-1 text-[12px] text-gray-500 dark:text-gray-400">
                            {STAGE_META[a.stage].description}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      {a.acknowledged ? (
                        <span className="text-[12px] text-emerald-600">
                          <i className="fas fa-check mr-1" />
                          Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => api.acknowledgeAlert(a.id)}
                          className="rounded-lg bg-[#0866FF] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0756d8]"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(open ? null : a.id)}
                        className="text-[12px] font-medium text-[#0866FF] hover:underline"
                      >
                        {open ? 'Hide context' : 'Show context'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <PrototypeNotice />
      </main>
    </div>
  );
};

export default GuardianPage;
