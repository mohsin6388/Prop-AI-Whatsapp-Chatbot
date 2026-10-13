import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Mail, Loader2, Send, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight, Pause, Play, Ban, RotateCcw, CalendarClock, ChevronDown } from 'lucide-react';
import { outreachApi, campaignApi } from '../../api/outreachApi.js';
import { useOutreachEvents, useOutreachSummaryQuery, useSocketConnected, SUMMARY_KEY } from '../../hooks/useOutreachLive.js';
import StatusChip, { fmtDateTime } from './StatusChip.jsx';
import CampaignCard from './CampaignCard.jsx';
import StepPipeline from './StepPipeline.jsx';
import CampaignLeadsTable from './CampaignLeadsTable.jsx';

const CAMPAIGNS_KEY = ['outreach', 'campaigns'];

const CHANNEL_META = {
  whatsapp: {
    title: 'WhatsApp Leads',
    subtitle: 'Bulk WhatsApp messages — ek-ek karke, live status ke saath',
    icon: MessageCircle,
    contact: (j) => j.phone,
  },
  email: {
    title: 'Email Leads',
    subtitle: 'Bulk emails — WhatsApp ke baad ek-ek karke, live status ke saath',
    icon: Mail,
    contact: (j) => j.email || '—',
  },
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'processing', label: 'Sending' },
  { value: 'pending', label: 'In queue' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'failed', label: 'Failed' },
];

function StatCard({ icon: Icon, label, value, tone, hint }) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={18} />
        </span>
        <div>
          <p className="text-xs text-ink-500 dark:text-ink-400">{label}</p>
          <p className="font-display text-xl font-bold text-ink-900 dark:text-white">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
}

export default function OutreachPage({ channel }) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  const qc = useQueryClient();

  const [filter, setFilter] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [page, setPage] = useState(1);
  const [nowSending, setNowSending] = useState(null); // { jobId, campaignId, name, contact }
  const [lastDone, setLastDone] = useState(null); // { name, status, at }
  const [showAll, setShowAll] = useState(false);
  const live = useSocketConnected();
  const [busy, setBusy] = useState(false);

  /* ---------------- data ---------------- */
  const { data: summaryAll } = useOutreachSummaryQuery();
  const stats = summaryAll?.[channel];
  // Kuch bhi queue/sending mein hai to list ko har 4s refresh karo (socket ka backup)
  const hasActive = Boolean(stats && stats.pending + stats.processing > 0);

  const { data: campaignsData } = useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: () => campaignApi.list().then((r) => r.data),
    staleTime: 10_000,
    refetchInterval: hasActive ? 4000 : false,
  });
  const campaigns = useMemo(
    () => (campaignsData?.campaigns || []).filter((c) => c.channels?.[channel]),
    [campaignsData, channel],
  );

    const { data: jobsData, isLoading, isFetching } = useQuery({
    queryKey: ['outreach', 'jobs', channel, filter, page],
    queryFn: () =>
      outreachApi
        .jobs({
          channel,
          page,
          limit: 50,
          ...(filter ? { status: filter } : {}),
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
    refetchInterval: hasActive ? 4000 : false,
  });
  const jobs = jobsData?.jobs || [];
  const pagination = jobsData?.pagination;

  /* ---------------- live events ---------------- */
  const refreshAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
    qc.invalidateQueries({ queryKey: ['outreach', 'jobs'] });
    qc.invalidateQueries({ queryKey: SUMMARY_KEY });
  }, [qc]);

  useOutreachEvents({
    onJob: (p) => {
      if (p.channel !== channel) return;

      // "Ab ye lead bheji ja rahi hai" banner
      if (p.status === 'processing') {
        setNowSending({
          jobId: p.jobId,
          campaignId: p.campaignId,
          name: p.name,
          contact: channel === 'email' ? p.email : p.phone,
        });
      } else {
        setNowSending((cur) => (cur?.jobId === p.jobId ? null : cur));
        if (p.status === 'sent' || p.status === 'failed') {
          setLastDone({ name: p.name, status: p.status, at: new Date() });
        }
      }

      // Table ki wahi row jagah par update (refetch nahi, flicker nahi)
      qc.setQueriesData({ queryKey: ['outreach', 'jobs', channel] }, (old) => {
        if (!old?.jobs) return old;
        return {
          ...old,
          jobs: old.jobs.map((j) =>
            j.id === p.jobId
              ? {
                  ...j,
                  status: p.status,
                  attempts: p.attempts,
                  sentAt: p.sentAt,
                  nextRunAt: p.nextRunAt,
                  lastError: p.lastError,
                  scheduled: p.status === 'pending' && new Date(p.nextRunAt) > new Date(),
                }
              : j,
          ),
        };
      });
    },
    onProgress: (p) => {
      qc.setQueryData(CAMPAIGNS_KEY, (old) => {
        if (!old?.campaigns) return old;
        return {
          ...old,
          campaigns: old.campaigns.map((c) => (String(c._id) === p.campaignId ? { ...c, stats: p.stats } : c)),
        };
      });
    },
    onCampaign: refreshAll,
    onReconnect: refreshAll,
  });

  /* ---------------- actions ---------------- */
  const handleAction = async (action, campaign, ch) => {
    if (action === 'cancel' && !confirm(`Cancel "${campaign.name}"? Pending messages nahi jayenge.`)) return;
    setBusy(true);
    try {
      const id = campaign._id;
      if (action === 'pause') await campaignApi.pause(id);
      if (action === 'resume') await campaignApi.resume(id);
      if (action === 'cancel') await campaignApi.cancel(id);
      if (action === 'retry') await campaignApi.retryFailed(id, ch);
      refreshAll();
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- derived ---------------- */
  const selected = campaigns.find((c) => c._id === campaignId) || campaigns[0] || null;
  const sendingStats = nowSending
    ? campaigns.find((c) => c._id === nowSending.campaignId)?.stats?.[channel]
    : null;
  const position = sendingStats ? sendingStats.sent + sendingStats.failed + 1 : null;
  const s = stats || { total: 0, sent: 0, failed: 0, pending: 0, processing: 0, paused: 0, scheduled: 0 };
  const queued = s.pending + s.paused;
  const pct = s.total ? Math.round((s.sent / s.total) * 100) : 0;
  const todayDue = s.pending - s.scheduled;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900 dark:text-white">
            <Icon size={24} className="text-brand-600" /> {meta.title}
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{meta.subtitle}</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            live
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
          title={live ? 'Realtime updates chal rahe hain' : 'Realtime connect nahi hai — page har 4 sec mein khud refresh ho raha hai'}
        >
          <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-green-500' : 'bg-amber-500'}`} />
          {live ? 'Live' : 'Auto-refreshing'}
        </span>
      </div>

      {/* Now sending banner */}
      <div
        className={`mt-5 overflow-hidden rounded-xl border text-sm transition ${
          nowSending || s.processing > 0
            ? 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100'
            : 'border-ink-100 bg-white text-ink-500 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          {nowSending ? (
            <>
              <Loader2 size={18} className="shrink-0 animate-spin" />
              <span>
                {channel === 'email' ? 'Email bheja ja raha hai' : 'WhatsApp bheja ja raha hai'} →{' '}
                <b>{nowSending.name}</b>
                {nowSending.contact && <span className="opacity-70"> ({nowSending.contact})</span>}
              </span>
              {position && sendingStats && (
                <span className="ml-auto rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold dark:bg-white/10">
                  {Math.min(position, sendingStats.total)} of {sendingStats.total}
                </span>
              )}
            </>
          ) : s.processing > 0 || todayDue > 0 ? (
            <>
              <Loader2 size={18} className="shrink-0 animate-spin" />
              <span>Agla message shuru ho raha hai…</span>
            </>
          ) : queued > 0 && summaryAll?.[channel]?.nextRunAt ? (
            <>
              <Clock size={18} className="shrink-0" />
              <span>Abhi koi message nahi ja raha — agla batch {fmtDateTime(summaryAll[channel].nextRunAt)} ko</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={18} className="shrink-0" />
              <span>Abhi kuch nahi bheja ja raha</span>
            </>
          )}
        </div>
        {(nowSending || s.processing > 0 || todayDue > 0) && (
          <div className="h-1 w-full bg-brand-100 dark:bg-brand-900/40">
            <div className="h-full w-1/3 animate-pulse rounded-r-full bg-brand-500" />
          </div>
        )}
        {lastDone && (
          <div className="border-t border-ink-100/60 px-4 py-2 text-xs text-ink-600 dark:border-ink-800 dark:text-ink-300">
            {lastDone.status === 'sent' ? '✓ Complete' : '✗ Failed'}: <b>{lastDone.name}</b> ·{' '}
            {lastDone.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Send} label="Total" value={s.total} tone="bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300" hint={`${pct}% complete`} />
        <StatCard icon={CheckCircle2} label="Sent" value={s.sent} tone="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" />
        <StatCard
          icon={Clock}
          label="Pending"
          value={queued}
          tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          hint={s.scheduled ? `${s.scheduled} scheduled for later days${todayDue > 0 ? `, ${todayDue} due now` : ''}` : undefined}
        />
        <StatCard icon={XCircle} label="Failed" value={s.failed} tone="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" />
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div className="bg-green-500 transition-all duration-500" style={{ width: `${s.total ? (s.sent / s.total) * 100 : 0}%` }} />
        <div className="bg-red-500 transition-all duration-500" style={{ width: `${s.total ? (s.failed / s.total) * 100 : 0}%` }} />
      </div>

      {/* Live campaign view */}
      {selected && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">{selected.name}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-500 dark:text-ink-400">
                <span>{selected.totalLeads} leads</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={12} />
                  {selected.dailyLimit > 0
                    ? `${selected.dailyLimit}/day at ${selected.sendTime} · ${selected.totalDays} day${selected.totalDays > 1 ? 's' : ''}`
                    : 'All at once'}
                </span>
                <span className="capitalize">· {selected.status}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.status === 'active' && (
                <button disabled={busy} onClick={() => handleAction('pause', selected)} className="btn-secondary !px-3 !py-1.5 !text-xs">
                  <Pause size={13} className="mr-1.5" /> Pause
                </button>
              )}
              {selected.status === 'paused' && (
                <button disabled={busy} onClick={() => handleAction('resume', selected)} className="btn-secondary !px-3 !py-1.5 !text-xs">
                  <Play size={13} className="mr-1.5" /> Resume
                </button>
              )}
              {selected.stats.whatsapp.failed + selected.stats.email.failed > 0 && (
                <button disabled={busy} onClick={() => handleAction('retry', selected)} className="btn-secondary !px-3 !py-1.5 !text-xs">
                  <RotateCcw size={13} className="mr-1.5" /> Retry failed
                </button>
              )}
              {(selected.status === 'active' || selected.status === 'paused') && (
                <button disabled={busy} onClick={() => handleAction('cancel', selected)} className="btn-secondary !px-3 !py-1.5 !text-xs !text-red-600">
                  <Ban size={13} className="mr-1.5" /> Cancel
                </button>
              )}
            </div>
          </div>

          <StepPipeline campaign={selected} />
          <div className="mt-4">
            <CampaignLeadsTable key={selected._id} campaign={selected} />
          </div>
        </section>
      )}

      {/* All campaigns */}
      {campaigns.length > 1 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-900 dark:text-white">All campaigns</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {campaigns.map((c) => (
              <CampaignCard
                key={c._id}
                campaign={c}
                channel={channel}
                selected={selected?._id === c._id}
                busy={busy}
                onSelect={() => setCampaignId(c._id)}
                onAction={handleAction}
              />
            ))}
          </div>
        </section>
      )}

      {/* Lead-wise list (saare sends, campaign ke bina bhi) */}
      {campaigns.length > 0 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          <ChevronDown size={16} className={`transition ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'Hide' : 'Show'} all {channel === 'email' ? 'email' : 'WhatsApp'} sends (filters ke saath)
        </button>
      )}
      {(campaigns.length === 0 || showAll) && (
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">
            All sends
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setFilter(f.value);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === f.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-800 dark:text-ink-400">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">{channel === 'email' ? 'Email' : 'Phone'}</th>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-ink-500">
                    <Loader2 className="mx-auto animate-spin" />
                  </td>
                </tr>
              )}
              {!isLoading && jobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-ink-500 dark:text-ink-400">
                    No leads here yet. Leads page se bulk upload karke campaign start karo.
                  </td>
                </tr>
              )}
              {jobs.map((j) => (
                <tr
                  key={j.id}
                  className={`border-t border-ink-100 transition-colors dark:border-ink-800 ${
                    j.status === 'processing' ? 'bg-brand-50 dark:bg-brand-950/30' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{j.name}</td>
                  <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{meta.contact(j)}</td>
                  <td className="px-4 py-3 text-ink-500 dark:text-ink-400">
                    {j.dayNumber ? `Day ${j.dayNumber}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip job={j} />
                    {j.lastError && (j.status === 'failed' || j.status === 'paused' || j.scheduled) && (
                      <p className="mt-1 max-w-xs truncate text-xs text-red-600 dark:text-red-400" title={j.lastError}>
                        {j.lastError}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-ink-500 dark:text-ink-400">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} leads {isFetching && '· updating…'}
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary !px-2.5 !py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              <button className="btn-secondary !px-2.5 !py-1.5" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
