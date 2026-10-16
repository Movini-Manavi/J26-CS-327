import moment from 'moment';

export function ageFromDob(dob: string): number | null {
  const m = moment(dob, 'YYYY-MM-DD', true);
  return m.isValid() ? moment().diff(m, 'years') : null;
}

export function shortTime(iso: string): string {
  const m = moment(iso);
  if (m.isSame(moment(), 'day')) return m.format('h:mm A');
  if (m.isAfter(moment().subtract(6, 'days'))) return m.format('ddd');
  return m.format('MMM D');
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
