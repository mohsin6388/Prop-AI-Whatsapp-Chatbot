import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Mail, Loader2, Send, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { outreachApi, campaignApi } from '../../api/outreachApi.js';
import { useOutreachEvents, useOutreachSummaryQuery, SUMMARY_KEY } from '../../hooks/useOutreachLive.js';
import StatusChip, { fmtDateTime } from './StatusChip.jsx';
import CampaignCard from './CampaignCard.jsx';
import CampaignLauncher from './CampaignLauncher.jsx';

const CAMPAIGNS_KEY = ['outreach', 'campaigns'];

const CHANNEL_META = {
  whatsapp: {
    title: 'WhatsApp Bulk Messages',
    subtitle: 'Approved Meta templates ke saath queued sending aur live progress.',
    icon: MessageCircle,
    contact: (j) => j.phone,
  },
  email: {
    title: 'Bulk Email',
    subtitle: 'Resend API se queued email campaigns aur live delivery status.',
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
  const [nowSending, setNowSending] = useState(null); // { jobId, name, contact }
  const [busy, setBusy] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);

  /* ---------------- data ---------------- */
  const { data: summaryAll } = useOutreachSummaryQuery();
  const stats = summaryAll?.[channel];

  const { data: campaignsData } = useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: () => campaignApi.list().then((r) => r.data.data),
    staleTime: 10_000,
  });
  const campaigns = useMemo(
    () => (campaignsData?.campaigns || []).filter((c) => c.channels?.[channel]),
    [campaignsData, channel],
  );

  const jobsKey = ['outreach', 'jobs', channel, campaignId, filter, page];
  const { data: jobsData, isLoading, isFetching } = useQuery({
    queryKey: jobsKey,
    queryFn: () =>
      outreachApi
        .jobs({
          channel,
          page,
          limit: 50,
          ...(campaignId ? { campaignId } : {}),
          ...(filter ? { status: filter } : {}),
        })
        .then((r) => r.data.data),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
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
          name: p.name,
          contact: channel === 'email' ? p.email : p.phone,
        });
      } else {
        setNowSending((cur) => (cur?.jobId === p.jobId ? null : cur));
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
        <button type="button" onClick={() => setLaunchOpen(true)} className="btn-primary flex items-center gap-2"><Send size={16} /> Create bulk campaign</button>
      </div>

      {/* Now sending banner */}
      <div
        className={`mt-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
          nowSending
            ? 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100'
            : 'border-ink-100 bg-white text-ink-500 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400'
        }`}
      >
        {nowSending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>
              Sending to <b>{nowSending.name}</b> {nowSending.contact && <span className="opacity-70">({nowSending.contact})</span>}…
            </span>
          </>
        ) : s.processing > 0 ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Sending…
          </>
        ) : queued > 0 && summaryAll?.[channel]?.nextRunAt ? (
          <>
            <Clock size={18} /> Idle — next batch {fmtDateTime(summaryAll[channel].nextRunAt)}
          </>
        ) : (
          <>
            <CheckCircle2 size={18} /> Nothing is being sent right now
          </>
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

      {/* Campaigns */}
      {campaigns.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-900 dark:text-white">Campaigns</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {campaigns.map((c) => (
              <CampaignCard
                key={c._id}
                campaign={c}
                channel={channel}
                selected={campaignId === c._id}
                busy={busy}
                onSelect={() => {
                  setCampaignId((cur) => (cur === c._id ? '' : c._id));
                  setPage(1);
                }}
                onAction={handleAction}
              />
            ))}
          </div>
        </section>
      )}

      {/* Lead-wise list */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">
            Leads {campaignId && <span className="text-sm font-normal text-ink-500">(filtered by campaign — click it again to clear)</span>}
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
                    Abhi is filter mein messages nahi hain. Upload Data se contacts import karein, phir Create bulk campaign se contacts select karein.
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
      {launchOpen && <CampaignLauncher channel={channel} onClose={() => setLaunchOpen(false)} onLaunched={refreshAll} />}
    </div>
  );
}
