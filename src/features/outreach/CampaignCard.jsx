import { Pause, Play, Ban, RotateCcw, CalendarClock } from 'lucide-react';
import { fmtDateTime } from './StatusChip.jsx';

const STATUS_STYLE = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  cancelled: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
};

function ChannelBar({ label, s, color }) {
  const done = s.sent + s.failed + s.cancelled;
  const pct = s.total ? Math.round((done / s.total) * 100) : 0;
  const sentPct = s.total ? (s.sent / s.total) * 100 : 0;
  const failPct = s.total ? (s.failed / s.total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-ink-600 dark:text-ink-300">
        <span className="font-medium">{label}</span>
        <span>
          {s.sent}/{s.total} sent · {pct}%
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div className={`${color} transition-all duration-500`} style={{ width: `${sentPct}%` }} />
        <div className="bg-red-500 transition-all duration-500" style={{ width: `${failPct}%` }} />
      </div>
    </div>
  );
}

/** channel = jis outreach page par card dikh raha hai; doosra channel bhi chhota dikhta hai */
export default function CampaignCard({ campaign, channel, selected, onSelect, onAction, busy }) {
  const c = campaign;
  const wa = c.stats.whatsapp;
  const em = c.stats.email;
  const failed = (c.channels.whatsapp ? wa.failed : 0) + (c.channels.email ? em.failed : 0);
  const canPause = c.status === 'active';
  const canResume = c.status === 'paused';
  const canCancel = c.status === 'active' || c.status === 'paused';

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        selected
          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
          : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button onClick={onSelect} className="text-left">
          <p className="font-display font-semibold text-ink-900 dark:text-white">{c.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
            <span>{c.totalLeads} leads</span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={12} />
              {c.dailyLimit > 0
                ? `${c.dailyLimit}/day at ${c.sendTime} · ${c.totalDays} day${c.totalDays > 1 ? 's' : ''}`
                : 'All at once'}
            </span>
            {c.lastRunAt && c.dailyLimit > 0 && <span>last batch {fmtDateTime(c.lastRunAt)}</span>}
          </p>
        </button>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[c.status]}`}>
          {c.status}
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        {c.channels.whatsapp && (
          <ChannelBar label="WhatsApp" s={wa} color="bg-green-500" />
        )}
        {c.channels.email && <ChannelBar label="Email" s={em} color="bg-brand-500" />}
        {c.channels.email && c.leadsWithoutEmail > 0 && (
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {c.leadsWithoutEmail} lead(s) ke paas email nahi tha — unhe sirf WhatsApp gaya.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canPause && (
          <button disabled={busy} onClick={() => onAction('pause', c)} className="btn-secondary !px-3 !py-1.5 !text-xs">
            <Pause size={13} className="mr-1.5" /> Pause
          </button>
        )}
        {canResume && (
          <button disabled={busy} onClick={() => onAction('resume', c)} className="btn-secondary !px-3 !py-1.5 !text-xs">
            <Play size={13} className="mr-1.5" /> Resume
          </button>
        )}
        {failed > 0 && (
          <button disabled={busy} onClick={() => onAction('retry', c, channel)} className="btn-secondary !px-3 !py-1.5 !text-xs">
            <RotateCcw size={13} className="mr-1.5" /> Retry {failed} failed
          </button>
        )}
        {canCancel && (
          <button disabled={busy} onClick={() => onAction('cancel', c)} className="btn-secondary !px-3 !py-1.5 !text-xs !text-red-600">
            <Ban size={13} className="mr-1.5" /> Cancel
          </button>
        )}
      </div>
    </div>
  );
}
