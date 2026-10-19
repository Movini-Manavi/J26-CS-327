import React from 'react';
import { API_MODE } from '../../../lib/grooming/config';
import { STAGE_META } from '../../../lib/grooming/stages';
import { ConnectionState, StageLabel } from '../../../types/grooming';
import { cn } from '../../../utils';

const AVATAR_COLORS = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-fuchsia-500',
];

export const Avatar: React.FC<{
  name: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
  className?: string;
}> = ({ name, size = 'md', online, className }) => {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const initials = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-20 w-20 text-2xl',
  };
  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-semibold text-white',
          sizes[size],
          AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length],
        )}
      >
        {initials || '?'}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-[#242526]" />
      )}
    </div>
  );
};

export const StageBadge: React.FC<{
  stage: StageLabel;
  className?: string;
  showIcon?: boolean;
}> = ({ stage, className, showIcon = true }) => {
  const meta = STAGE_META[stage];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        meta.chip,
        className,
      )}
    >
      {showIcon && <i className={cn(meta.icon, 'text-[10px]')} />}
      {meta.label}
    </span>
  );
};

const CONNECTION_META: Record<ConnectionState, { label: string; dot: string }> =
  {
    connecting: { label: 'Connecting…', dot: 'bg-yellow-400' },
    live: { label: 'Live', dot: 'bg-green-500' },
    polling: { label: 'Polling (fallback)', dot: 'bg-orange-400' },
    offline: { label: 'Offline', dot: 'bg-red-500' },
  };

export const ConnectionBadge: React.FC<{ state: ConnectionState }> = ({
  state,
}) => {
  const meta = CONNECTION_META[state];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-neutral-700 dark:text-gray-300">
      <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
      {meta.label}
      {API_MODE === 'mock' && (
        <span className="text-gray-400 dark:text-gray-500">· mock</span>
      )}
    </span>
  );
};

export const PrototypeNotice: React.FC<{ className?: string }> = ({
  className,
}) => (
  <p
    className={cn(
      'text-[11px] leading-snug text-gray-500 dark:text-gray-400',
      className,
    )}
  >
    <i className="fas fa-flask mr-1" />
    Research prototype (SLIIT IT4010 · J26-CS-327). Not a validated detector or
    safety product. Fictional users and made-up conversations only.
    {API_MODE === 'mock' &&
      ' Labels shown now come from a keyword mock, not the model.'}
  </p>
);
