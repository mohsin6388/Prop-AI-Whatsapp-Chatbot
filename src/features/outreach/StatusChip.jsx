import { Loader2, CheckCircle2, Clock, XCircle, Pause, Ban, Hourglass } from 'lucide-react';

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap';

/**
 * Ek lead/job ka status. 'processing' par spinner chalta hai — worker ek
 * time par ek hi bhejta hai, isliye ek channel mein ek hi spinner dikhega.
 */
export default function StatusChip({ job }) {
  if (job.status === 'processing') {
    return (
      <span className={`${base} bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200`}>
        <Loader2 size={13} className="animate-spin" /> Sending…
      </span>
    );
  }
  if (job.status === 'sent') {
    return (
      <span className={`${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300`}>
        <CheckCircle2 size={13} /> Sent{job.sentAt ? ` · ${fmtDateTime(job.sentAt)}` : ''}
      </span>
    );
  }
  if (job.status === 'failed') {
    return (
      <span className={`${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`}>
        <XCircle size={13} /> Failed
      </span>
    );
  }
  if (job.status === 'paused') {
    return (
      <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300`}>
        <Pause size={13} /> Paused
      </span>
    );
  }
  if (job.status === 'cancelled') {
    return (
      <span className={`${base} bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400`}>
        <Ban size={13} /> Cancelled
      </span>
    );
  }
  // pending
  if (job.scheduled) {
    return (
      <span className={`${base} bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300`}>
        <Clock size={13} /> {fmtDateTime(job.nextRunAt)}
      </span>
    );
  }
  return (
    <span className={`${base} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300`}>
      <Hourglass size={13} /> In queue
    </span>
  );
}
