import { useFormik } from 'formik';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Yup from 'yup';
import {
  Avatar,
  ConnectionBadge,
  PrototypeNotice,
  StageBadge,
} from '../../components/organisms/grooming/common';
import { API_MODE, DEMO_KEY, DEMO_USER } from '../../lib/grooming/config';
import { ageFromDob, shortId, shortTime } from '../../lib/grooming/format';
import { useGroomingData } from '../../lib/grooming/useGroomingData';
import { useNoIndex } from '../../lib/grooming/useNoIndex';
import { uuid } from '../../lib/grooming/uuid';
import { StageLabel } from '../../types/grooming';
import { cn } from '../../utils';

const KEY_STORAGE = 'grooming-demo-key';

/** Made-up example lines for demoing each stage. */
const PRESETS: { stage: StageLabel; text: string }[] = [
  { stage: 'none', text: 'hey, are you coming to practice tomorrow?' },
  { stage: 'none', text: 'lol that video was so funny' },
  { stage: 'Trust-Building', text: "you're so mature for your age" },
  {
    stage: 'Trust-Building',
    text: "you can tell me anything, i'm here for you",
  },
  { stage: 'Isolation', text: "don't tell your parents we talk ok?" },
  { stage: 'Isolation', text: 'are you alone right now?' },
  { stage: 'Desensitization', text: "it's totally normal, everyone does it" },
  { stage: 'Desensitization', text: 'do you have a boyfriend?' },
  { stage: 'Solicitation', text: 'send me a selfie' },
  { stage: 'Solicitation', text: 'we should meet up this weekend' },
];

const contactSchema = Yup.object({
  name: Yup.string().trim().min(2, 'Too short').max(60).required('Required'),
  dob: Yup.string()
    .required('Required')
    .test(
      'past',
      'Must be a past date',
      (v) => !!v && new Date(v) < new Date(),
    ),
  phone: Yup.string()
    .trim()
    .matches(/^\+?[0-9][0-9\s-]{6,16}$/, 'Enter one phone number')
    .required('Required'),
});

const KeyGate: React.FC<{ onUnlock: (key: string) => void }> = ({
  onUnlock,
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5] p-4 dark:bg-[#18191A]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // In http mode the backend checks the key on every request.
          if (API_MODE === 'mock' && value !== DEMO_KEY) {
            setError('Wrong demo key');
            return;
          }
          onUnlock(value);
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg dark:bg-[#242526]"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0866FF]/10 text-[#0866FF]">
          <i className="fas fa-key text-xl" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Sender simulator
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter the shared demo key to continue.
        </p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          placeholder="Demo key"
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#0866FF] focus:outline-none dark:border-neutral-600 dark:bg-[#3A3B3C] dark:text-white"
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-[#0866FF] py-2 font-semibold text-white hover:bg-[#0756d8]"
        >
          Unlock
        </button>
        {API_MODE === 'mock' && (
          <p className="mt-3 text-center text-[12px] text-gray-400">
            Mock mode key: <code>{DEMO_KEY}</code> (set VITE_DEMO_KEY)
          </p>
        )}
      </form>
    </div>
  );
};

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[14px] text-gray-900 focus:border-[#0866FF] focus:outline-none dark:border-neutral-600 dark:bg-[#3A3B3C] dark:text-white';

const ChatAdminPage: React.FC = () => {
  useNoIndex('Sender simulator (demo)');

  const [demoKey, setDemoKey] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(KEY_STORAGE);
    } catch {
      return null;
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState(uuid);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { contacts, messages, alerts, connection, api } = useGroomingData();

  const unlock = (key: string) => {
    try {
      sessionStorage.setItem(KEY_STORAGE, key);
    } catch {}
    setDemoKey(key);
  };

  const lock = () => {
    try {
      sessionStorage.removeItem(KEY_STORAGE);
    } catch {}
    setDemoKey(null);
  };

  const formik = useFormik({
    initialValues: { name: '', dob: '', phone: '' },
    validationSchema: contactSchema,
    onSubmit: async (values, helpers) => {
      if (!demoKey) return;
      setError(null);
      try {
        const contact = await api.addContact(values, demoKey);
        setSelectedId(contact.id);
        helpers.resetForm();
        setPreviewId(uuid());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create contact');
      }
    },
  });

  useEffect(() => {
    if (!selectedId && contacts.length) setSelectedId(contacts[0].id);
  }, [contacts, selectedId]);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;
  const thread = useMemo(
    () => messages.filter((m) => m.contact_id === selectedId),
    [messages, selectedId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.length]);

  if (!demoKey) return <KeyGate onUnlock={unlock} />;

  const send = async (text: string) => {
    const body = text.trim();
    if (!selected || !body || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.sendIncoming(selected.id, body, demoKey);
      setDraft('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send';
      setError(msg);
      if (/401|403|demo key/i.test(msg)) lock();
    } finally {
      setSending(false);
    }
  };

  const fieldError = (name: 'name' | 'dob' | 'phone') =>
    formik.touched[name] && formik.errors[name] ? (
      <p className="mt-0.5 text-[12px] text-red-500">{formik.errors[name]}</p>
    ) : null;

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#18191A]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-[#242526]">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0866FF] text-white">
          <i className="fas fa-paper-plane" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight text-gray-900 dark:text-white">
            Sender simulator
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            Send messages as a contact to {DEMO_USER.name} (
            {DEMO_USER.label.toLowerCase()})
          </p>
        </div>
        <ConnectionBadge state={connection} />
        <Link
          to="/chat"
          target="_blank"
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-[13px] font-semibold text-gray-800 hover:bg-gray-200 dark:bg-[#3A3B3C] dark:text-gray-100"
        >
          Open /chat <i className="fas fa-external-link-alt ml-1 text-[10px]" />
        </Link>
        <Link
          to="/guardian"
          target="_blank"
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-[13px] font-semibold text-gray-800 hover:bg-gray-200 dark:bg-[#3A3B3C] dark:text-gray-100"
        >
          Open /guardian{' '}
          <i className="fas fa-external-link-alt ml-1 text-[10px]" />
        </Link>
        {api.resetDemo && (
          <button
            onClick={() => {
              if (window.confirm('Wipe all demo data and reseed?')) {
                setSelectedId(null);
                api.resetDemo?.();
              }
            }}
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Reset demo data
          </button>
        )}
        <button
          onClick={lock}
          title="Lock"
          className="h-8 w-8 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-[#3A3B3C]"
        >
          <i className="fas fa-lock" />
        </button>
      </header>

      {error && (
        <p className="bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      <main className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[340px,1fr]">
        {/* Left column: contacts */}
        <div className="space-y-4">
          <form
            onSubmit={formik.handleSubmit}
            className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#242526]"
          >
            <h2 className="font-semibold text-gray-900 dark:text-white">
              New contact
            </h2>
            <p className="mb-3 text-[12px] text-gray-500 dark:text-gray-400">
              Fictional people only.
            </p>
            <label className="mb-1 block text-[12px] font-medium text-gray-600 dark:text-gray-300">
              ID (auto-generated)
            </label>
            <input
              readOnly
              value={previewId}
              className={cn(inputClass, 'font-mono text-[12px] text-gray-500')}
            />
            <p className="mb-2 mt-0.5 text-[11px] text-gray-400">
              {API_MODE === 'http'
                ? 'Final ID is assigned by the backend.'
                : 'Preview; a fresh UUID is assigned on save.'}
            </p>
            <label className="mb-1 block text-[12px] font-medium text-gray-600 dark:text-gray-300">
              Name
            </label>
            <input
              {...formik.getFieldProps('name')}
              placeholder="e.g. Jay (gamer_jay)"
              className={inputClass}
            />
            {fieldError('name')}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-600 dark:text-gray-300">
                  Date of birth
                </label>
                <input
                  type="date"
                  {...formik.getFieldProps('dob')}
                  className={inputClass}
                />
                {fieldError('dob')}
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-600 dark:text-gray-300">
                  Phone
                </label>
                <input
                  {...formik.getFieldProps('phone')}
                  placeholder="+94 77 000 0000"
                  className={inputClass}
                />
                {fieldError('phone')}
              </div>
            </div>
            <button
              type="submit"
              disabled={formik.isSubmitting}
              className="mt-3 w-full rounded-lg bg-[#0866FF] py-2 text-[14px] font-semibold text-white hover:bg-[#0756d8] disabled:opacity-60"
            >
              <i className="fas fa-user-plus mr-2" />
              Create contact
            </button>
          </form>

          <div className="rounded-2xl bg-white p-2 shadow-sm dark:bg-[#242526]">
            <h2 className="px-2 pb-1 pt-2 font-semibold text-gray-900 dark:text-white">
              Contacts ({contacts.length})
            </h2>
            {contacts.map((c) => {
              const count = alerts.filter((a) => a.contact_id === c.id).length;
              const age = ageFromDob(c.dob);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-2 text-left',
                    c.id === selectedId
                      ? 'bg-[#EBF5FF] dark:bg-[#2D88FF]/20'
                      : 'hover:bg-gray-100 dark:hover:bg-[#3A3B3C]',
                  )}
                >
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-white">
                      {c.name}
                    </p>
                    <p className="truncate text-[12px] text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{shortId(c.id)}</span> ·{' '}
                      {age !== null ? `age ${age}` : c.dob} · {c.phone}
                    </p>
                  </div>
                  {count > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      {count} alert{count > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: compose */}
        <section className="flex min-h-[70vh] flex-col rounded-2xl bg-white shadow-sm dark:bg-[#242526]">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-gray-500">
              Create or select a contact
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-gray-200 p-3 dark:border-neutral-700">
                <Avatar name={selected.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
                    Sending as {selected.name}
                  </p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">
                    to {DEMO_USER.name}
                  </p>
                </div>
              </div>

              <div className="fb-scrollbar max-h-[55vh] flex-1 overflow-y-auto p-4">
                {thread.length === 0 && (
                  <p className="text-center text-sm text-gray-500">
                    No messages yet.
                  </p>
                )}
                {thread.map((m) => {
                  // Here the contact is "me", so incoming messages sit on the right.
                  const mine = m.direction === 'incoming';
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'mb-2 flex flex-col',
                        mine ? 'items-end' : 'items-start',
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] whitespace-pre-wrap break-words rounded-[18px] px-3 py-2 text-[14px]',
                          mine
                            ? 'bg-[#0866FF] text-white'
                            : 'bg-gray-100 text-gray-900 dark:bg-[#3A3B3C] dark:text-gray-100',
                        )}
                      >
                        {m.body}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                        {!mine && <span>{DEMO_USER.name} ·</span>}
                        <span>{shortTime(m.created_at)}</span>
                        {mine && m.analysis && (
                          <StageBadge stage={m.analysis.label} />
                        )}
                        {mine && alerts.some((a) => a.message_id === m.id) && (
                          <span className="font-semibold text-red-500">
                            <i className="fas fa-bell mr-0.5" />
                            alert
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-gray-200 p-3 dark:border-neutral-700">
                <p className="mb-2 text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Quick messages (made-up examples)
                </p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.text}
                      onClick={() => setDraft(p.text)}
                      title={p.stage}
                      className="rounded-full border border-gray-200 px-2.5 py-1 text-[12px] text-gray-700 hover:bg-gray-100 dark:border-neutral-600 dark:text-gray-200 dark:hover:bg-[#3A3B3C]"
                    >
                      {p.text}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(draft);
                  }}
                  className="flex gap-2"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send(draft);
                      }
                    }}
                    rows={2}
                    placeholder={`Message as ${selected.name}…`}
                    className={cn(inputClass, 'resize-none')}
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="rounded-lg bg-[#0866FF] px-4 font-semibold text-white hover:bg-[#0756d8] disabled:opacity-50"
                  >
                    {sending ? (
                      <i className="fas fa-circle-notch fa-spin" />
                    ) : (
                      'Send'
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </main>

      <PrototypeNotice className="mx-auto max-w-6xl px-4 pb-6" />
    </div>
  );
};

export default ChatAdminPage;
