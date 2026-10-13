import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { outreachApi } from '../../api/outreachApi.js';
import { useOutreachEvents } from '../../hooks/useOutreachLive.js';
import StatusChip from './StatusChip.jsx';

const PAGE_SIZE = 25;

function Cell({ job, label }) {
  if (!job) return <span className="text-xs text-ink-400">—</span>;
  return (
    <div>
      <StatusChip job={job} />
      {job.lastError && (job.status === 'failed' || job.status === 'paused' || job.scheduled) && (
        <p className="mt-1 max-w-[220px] truncate text-xs text-red-600 dark:text-red-400" title={job.lastError}>
          {job.lastError}
        </p>
      )}
      {job.status === 'pending' && !job.scheduled && label && (
        <p className="mt-1 text-[11px] text-ink-400">{label}</p>
      )}
    </div>
  );
}

function SkeletonRows({ cols }) {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j} className="px-4 py-4">
          <div className="h-4 animate-pulse rounded bg-ink-100 dark:bg-ink-800" style={{ width: `${55 + ((i + j) % 3) * 15}%` }} />
        </td>
      ))}
    </tr>
  ));
}

/** Ek campaign ki leads: har row mein WhatsApp aur Email dono ka live status */
export default function CampaignLeadsTable({ campaign }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const hasWa = campaign.channels.whatsapp;
  const hasEmail = campaign.channels.email;
  const cols = 3 + (hasWa ? 1 : 0) + (hasEmail ? 1 : 0);

  const busy = ['whatsapp', 'email'].some((ch) => campaign.stats[ch].pending + campaign.stats[ch].processing > 0);
  const key = ['outreach', 'campaign-leads', campaign._id];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...key, page],
    queryFn: () => outreachApi.campaignLeads({ campaignId: campaign._id, page, limit: PAGE_SIZE }).then((r) => r.data),
    placeholderData: (prev) => prev,
    refetchInterval: busy ? 4000 : false,
  });

  // Socket event aate hi wahi row jagah par badal do (refetch nahi, flicker nahi)
  useOutreachEvents({
    onJob: (p) => {
      if (p.campaignId !== campaign._id) return;
      qc.setQueriesData({ queryKey: key }, (old) => {
        if (!old?.leads) return old;
        return {
          ...old,
          leads: old.leads.map((row) => {
            const job = row.jobs[p.channel];
            if (row.leadId !== p.leadId || !job || job.id !== p.jobId) return row;
            return {
              ...row,
              jobs: {
                ...row.jobs,
                [p.channel]: {
                  ...job,
                  status: p.status,
                  attempts: p.attempts,
                  sentAt: p.sentAt,
                  nextRunAt: p.nextRunAt,
                  lastError: p.lastError,
                  scheduled: p.status === 'pending' && new Date(p.nextRunAt) > new Date(),
                },
              },
            };
          }),
        };
      });
    },
  });

  const leads = data?.leads || [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Day</th>
              {hasWa && <th className="px-4 py-3">1 · WhatsApp</th>}
              {hasEmail && <th className="px-4 py-3">{hasWa ? '2 · ' : ''}Email</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows cols={cols} />}
            {!isLoading && leads.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-4 py-10 text-center text-ink-500 dark:text-ink-400">
                  Is campaign mein abhi koi lead nahi dikh rahi.
                </td>
              </tr>
            )}
            {leads.map((row) => {
              const sending = Object.values(row.jobs).some((j) => j?.status === 'processing');
              return (
                <tr
                  key={row.seq}
                  className={`border-t border-ink-100 transition-colors dark:border-ink-800 ${
                    sending ? 'bg-brand-50 dark:bg-brand-950/30' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-ink-400">{row.seq + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900 dark:text-white">{row.name}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {row.phone}
                      {row.leadEmail ? ` · ${row.leadEmail}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-500 dark:text-ink-400">Day {row.dayNumber}</td>
                  {hasWa && (
                    <td className="px-4 py-3">
                      <Cell job={row.jobs.whatsapp} label="Waiting for turn" />
                    </td>
                  )}
                  {hasEmail && (
                    <td className="px-4 py-3">
                      {row.jobs.email ? (
                        <Cell job={row.jobs.email} label={hasWa && row.jobs.whatsapp?.status !== 'sent' ? 'After WhatsApp' : 'Waiting for turn'} />
                      ) : (
                        <span className="text-xs text-ink-400">No email address</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
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
    </div>
  );
}
