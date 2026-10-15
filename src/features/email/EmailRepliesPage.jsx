import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, MessageSquareText, Clock3, CheckCircle2, Search, RefreshCw,
  ChevronLeft, ChevronRight, X, Send, Loader2, AlertTriangle, Inbox,
} from 'lucide-react';
import { emailApi } from '../../api/emailApi.js';

const FILTERS = [
  { value: '', label: 'All emails' },
  { value: 'replied', label: 'Replied' },
  { value: 'waiting', label: 'No reply yet' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'failed', label: 'Failed / suppressed' },
];

function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusPill({ status, replyStatus, type = 'delivery' }) {
  const label = type === 'reply' ? (replyStatus === 'replied' ? 'Replied' : ['queued', 'sending'].includes(status) ? 'Not sent yet' : ['bounced', 'failed', 'complained', 'suppressed', 'cancelled'].includes(status) ? 'Send issue' : 'No reply yet') : (status || 'waiting').replaceAll('_', ' ');
  const classes = (type === 'reply' && replyStatus === 'replied') || status === 'delivered'
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : ['bounced', 'failed', 'complained'].includes(status)
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}>{label}</span>;
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={19} /></span>
        <div><p className="text-xs text-ink-500 dark:text-ink-400">{label}</p><p className="text-xl font-bold text-ink-900 dark:text-white">{Number(value || 0).toLocaleString('en-IN')}</p></div>
      </div>
    </div>
  );
}

export default function EmailRepliesPage({ mode = 'conversations' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState(mode === 'conversations' ? 'replied' : '');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setState(mode === 'conversations' ? 'replied' : '');
    setPage(1);
    setSelected(null);
  }, [mode]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchDraft.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const fetchRows = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const response = await emailApi.replies({ page, limit: 25, ...(state ? { state } : {}), ...(search ? { search } : {}) });
      setData(response.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Email replies load nahi ho paaye. Backend aur Resend setup check karein.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, state, search]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const openThread = async (item) => {
    setSelected(item);
    setThread(null);
    setThreadError('');
    setReplyText('');
    setThreadLoading(true);
    try {
      const response = await emailApi.thread(item._id);
      setThread(response.data);
    } catch (err) {
      setThreadError(err?.response?.data?.message || 'Conversation load nahi hui');
    } finally {
      setThreadLoading(false);
    }
  };

  const sendReply = async () => {
    const text = replyText.trim();
    if (!text || !selected || replyBusy) return;
    setReplyBusy(true);
    setThreadError('');
    try {
      await emailApi.reply(selected._id, text);
      setReplyText('');
      const response = await emailApi.thread(selected._id);
      setThread(response.data);
      setNotice('Reply Resend ko send karne ke liye accept ho gaya. Delivery status webhook se update hoga.');
      setTimeout(() => setNotice(''), 4000);
      await fetchRows({ quiet: true });
    } catch (err) {
      setThreadError(err?.response?.data?.message || 'Reply send nahi ho paaya');
    } finally {
      setReplyBusy(false);
    }
  };

  const items = data?.items || [];
  const summary = data?.summary || {};
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 1 };
  const selectedLead = selected?.lead || {};
  const threadMessages = useMemo(() => thread?.messages || [], [thread]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">{mode === 'details' ? 'Email Details' : 'Email Conversations'}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">{mode === 'details' ? 'Email delivery, replies, waiting, bounced aur failed messages ka complete tracker.' : 'Jis customer ka reply aaya, uski conversation dekhein aur dashboard se jawab dein.'}</p>
        </div>
        <button onClick={() => fetchRows({ quiet: true })} disabled={refreshing} className="btn-secondary flex items-center gap-2">
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
        </button>
      </div>
      <div className="mt-4 inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
        <Link to="/email/conversations" className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'conversations' ? 'bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 dark:text-ink-300'}`}>Conversations</Link>
        <Link to="/email/details" className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'details' ? 'bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 dark:text-ink-300'}`}>Details</Link>
      </div>

      {notice && <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">{notice}</div>}
      {error && <div className="mt-4 flex gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"><AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />{error}</div>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Mail} label="Campaign emails" value={summary.total} tone="bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300" />
        <Stat icon={CheckCircle2} label="Replies received" value={summary.replied} tone="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300" />
        <Stat icon={Clock3} label="Awaiting reply" value={summary.waiting} tone="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300" />
        <Stat icon={Send} label="Queued / sending" value={summary.queued} tone="bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300" />
        <Stat icon={Inbox} label="Bounced / failed" value={(summary.bounced || 0) + (summary.failed || 0)} tone="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300" />
      </div>

      <div className="card mt-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button key={filter.value} onClick={() => { setState(filter.value); setPage(1); }} className={`rounded-full px-3 py-2 text-xs font-semibold transition ${state === filter.value ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'}`}>
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative w-full xl:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search recipient email or subject" className="input-field pl-9" />
          </div>
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-ink-50 dark:bg-ink-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-ink-500 dark:text-ink-300">Lead</th>
              <th className="px-4 py-3 text-left font-semibold text-ink-500 dark:text-ink-300">Email / Campaign</th>
              <th className="px-4 py-3 text-left font-semibold text-ink-500 dark:text-ink-300">Sent / queued</th>
              <th className="px-4 py-3 text-left font-semibold text-ink-500 dark:text-ink-300">Delivery</th>
              <th className="px-4 py-3 text-left font-semibold text-ink-500 dark:text-ink-300">Reply</th>
              <th className="px-4 py-3 text-right font-semibold text-ink-500 dark:text-ink-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-400"><Loader2 className="mx-auto animate-spin" size={23} /><p className="mt-2">Loading email tracker…</p></td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-400"><Inbox className="mx-auto mb-2" size={27} /><p>No campaign emails found.</p><p className="mt-1 text-xs">Resend se send ki hui emails yahan track hongi. Purane Gmail sends ka status import nahi hoga.</p></td></tr>
              : items.map((item) => (
                <tr key={item._id} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink-900 dark:text-white">{item.lead?.name || 'Lead deleted'}</p>
                    <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{item.lead?.phone || 'No WhatsApp number'}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.availableChannels?.whatsapp && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">WhatsApp lead</span>}
                      {!item.availableChannels?.whatsapp && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">Email only</span>}
                      {item.siteVisit && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Visit: {String(item.siteVisit.status || '').replaceAll('_', ' ')}{item.siteVisit.propertyId?.projectName ? ` · ${item.siteVisit.propertyId.projectName}` : ''}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-ink-800 dark:text-ink-100">{item.to || item.lead?.email || '—'}</p>
                    <p className="mt-0.5 max-w-[300px] truncate text-xs text-ink-500 dark:text-ink-400">{item.subject || 'No subject'}{item.campaign?.name ? ` · ${item.campaign.name}` : ''}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500 dark:text-ink-400">{fmtDate(item.sentAt || item.createdAt)}</td>
                  <td className="px-4 py-3"><StatusPill status={item.status} replyStatus={null} /></td>
                  <td className="px-4 py-3"><StatusPill status={item.status} replyStatus={item.hasReply ? 'replied' : item.replyStatus} type="reply" /><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{item.replyCount || 0} reply(s)</p></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openThread(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"><MessageSquareText size={14} /> View / Reply</button></td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 dark:border-ink-800">
          <p className="text-xs text-ink-500 dark:text-ink-400">{pagination.total ? `Showing ${(pagination.page - 1) * 25 + 1}–${Math.min(pagination.page * 25, pagination.total)} of ${pagination.total}` : '0 records'}</p>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-ink-200 p-2 disabled:opacity-40 dark:border-ink-700"><ChevronLeft size={16} /></button>
            <span className="text-xs text-ink-500 dark:text-ink-400">Page {pagination.page || 1} of {pagination.totalPages || 1}</span>
            <button disabled={page >= (pagination.totalPages || 1) || loading} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-ink-200 p-2 disabled:opacity-40 dark:border-ink-700"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900">
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-4 dark:border-ink-800 sm:p-5">
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Lead conversation</p><h2 className="mt-1 truncate text-lg font-bold text-ink-900 dark:text-white">{selectedLead.name || 'Email thread'}</h2><p className="mt-1 truncate text-sm text-ink-500 dark:text-ink-400">{selected.to} · {selected.subject}</p></div>
              <button onClick={() => setSelected(null)} aria-label="Close thread" className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"><X size={20} /></button>
            </div>
            {threadError && <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{threadError}</div>}
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {threadLoading ? <div className="py-12 text-center text-ink-400"><Loader2 className="mx-auto animate-spin" size={24} /><p className="mt-2 text-sm">Loading conversation…</p></div>
                : threadMessages.length === 0 ? <p className="py-8 text-center text-sm text-ink-400">No messages found in this thread.</p>
                : threadMessages.map((message) => {
                  const inbound = message.direction === 'inbound';
                  const body = message.text || String(message.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '(No readable message body)';
                  return <div key={message._id} className={`max-w-[92%] rounded-xl border p-3 sm:max-w-[85%] ${inbound ? 'mr-auto border-green-100 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10' : 'ml-auto border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800/70'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-ink-700 dark:text-ink-200">{inbound ? `Customer · ${message.from || selected.to}` : `You · ${message.from || 'Company'}`}</p><time className="text-[11px] text-ink-400">{fmtDate(message.receivedAt || message.sentAt || message.createdAt)}</time></div>
                    {message.subject && <p className="mt-2 text-xs font-semibold text-ink-700 dark:text-ink-200">{message.subject}</p>}
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-700 dark:text-ink-200">{body}</p>
                  </div>;
                })}
            </div>
            <div className="border-t border-ink-100 p-4 dark:border-ink-800 sm:p-5">
              <label className="mb-1.5 block text-sm font-semibold text-ink-800 dark:text-ink-100">Reply to this lead</label>
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} maxLength={10000} placeholder="Type your reply…" className="input-field resize-y" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-500 dark:text-ink-400">Replies are sent via Resend from your verified sender domain.</p><button onClick={sendReply} disabled={replyBusy || !replyText.trim() || !thread} className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">{replyBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send reply</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
