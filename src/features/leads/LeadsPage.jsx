import { useEffect, useState, useCallback } from 'react';
import { Plus, Upload, Search, Trash2, Pencil, Mail, MessageCircle, CalendarCheck, Users, Send, Clock3, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { leadApi } from '../../api/leadApi.js';
import LeadFormModal from './LeadFormModal.jsx';
import ImportLeadsModal from './ImportLeadsModal.jsx';

const STATUSES = ['new', 'contacted', 'qualified', 'hot', 'warm', 'cold', 'site_visit', 'closed', 'lost'];
const STATUS_COLORS = {
  new: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300', hot: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  warm: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', cold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', contacted: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  site_visit: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', closed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', lost: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function MessageState({ state, sentAt, replyAt }) {
  const value = String(state || 'not_sent').replaceAll('_', ' ');
  const tone = state === 'sent' || state === 'delivered' || state === 'read' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : state === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : state === 'pending' || state === 'processing' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';
  return <div className="min-w-[135px]"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${tone}`}>{value}</span><p className="mt-1 text-[11px] text-ink-400">{replyAt ? `Replied ${fmtDate(replyAt)}` : sentAt ? `Sent ${fmtDate(sentAt)}` : 'No activity yet'}</p></div>;
}

function Stat({ label, value, icon: Icon, tone }) {
  return <div className="card !p-3"><div className="flex items-center gap-2.5"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={16} /></span><div className="min-w-0"><p className="truncate text-[11px] text-ink-500 dark:text-ink-400">{label}</p><p className="font-display text-lg font-bold text-ink-900 dark:text-white">{Number(value || 0).toLocaleString('en-IN')}</p></div></div></div>;
}

export default function LeadsPage({ qualifiedOnly = false }) {
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ total: 0, whatsappAvailable: 0, emailAvailable: 0, bothAvailable: 0, whatsappOnly: 0, emailOnly: 0, siteVisits: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await leadApi.list({ page, limit: 50, ...(search.trim() ? { search: search.trim() } : {}), ...(status ? { status } : {}), ...(qualifiedOnly ? { qualifiedOnly: 1 } : {}) });
      setLeads(res.data.leads || []);
      setPagination(res.data.pagination || { page, limit: 50, total: 0, totalPages: 1 });
      setSummary(res.data.summary || { total: 0, whatsappAvailable: 0, emailAvailable: 0, bothAvailable: 0, whatsappOnly: 0, emailOnly: 0, siteVisits: 0 });
      setSelected([]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Leads load nahi hue. Connection check karke refresh karein.');
    } finally { setLoading(false); }
  }, [search, status, qualifiedOnly]);

  useEffect(() => { fetchLeads(1); }, [fetchLeads]);

  const toggleSelect = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const handleDelete = async (id) => {
    if (!window.confirm('Is lead ko delete karna hai? Is action ko undo nahi kiya ja sakta.')) return;
    try { await leadApi.remove(id); await fetchLeads(Math.min(pagination.page, pagination.totalPages || 1)); }
    catch (err) { setError(err?.response?.data?.message || 'Lead delete nahi hui.'); }
  };
  const handleBulkDelete = async () => {
    if (!selected.length || !window.confirm(`${selected.length} selected leads delete karni hain?`)) return;
    try { await leadApi.bulkDelete(selected); setSelected([]); await fetchLeads(1); }
    catch (err) { setError(err?.response?.data?.message || 'Selected leads delete nahi hui.'); }
  };

  return <div className="mx-auto max-w-[1800px] space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">{qualifiedOnly ? 'Buyer responses' : 'Contact database'}</p><h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">{qualifiedOnly ? 'Qualified Leads' : 'Upload Data'}</h1><p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">{qualifiedOnly ? 'Email replies and genuine WhatsApp responses. One-time autoresponders are kept out until the conversation continues.' : 'Upload contacts once, then choose WhatsApp or Email separately. Uploading data never sends a message.'}</p></div>
      <div className="flex flex-wrap gap-2">{!qualifiedOnly && <><button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2"><Upload size={16} /> Import CSV / Excel</button><button onClick={() => { setEditingLead(null); setShowForm(true); }} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add contact</button></>}<button onClick={() => fetchLeads(pagination.page)} disabled={loading} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
    </div>

    {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><span className="flex items-center gap-2"><AlertTriangle size={17} />{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Stat label={qualifiedOnly ? 'Qualified leads' : 'Total contacts'} value={qualifiedOnly ? pagination.total : summary.total} icon={Users} tone="bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300" />
      <Stat label="WhatsApp ready" value={summary.whatsappAvailable} icon={MessageCircle} tone="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300" />
      <Stat label="Email ready" value={summary.emailAvailable} icon={Mail} tone="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" />
      <Stat label="Both channels" value={summary.bothAvailable} icon={Send} tone="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300" />
      <Stat label="Customer replied" value={leads.filter((lead) => lead.replyReceived).length} icon={CheckCircle2} tone="bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300" />
      <Stat label="Site visit records" value={summary.siteVisits} icon={CalendarCheck} tone="bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300" />
    </div>

    <div className="card flex flex-wrap items-center gap-3 !p-3"><div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, mobile, city…" className="input-field pl-9" /></div><select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field w-auto min-w-[150px]"><option value="">All lead statuses</option>{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>{selected.length > 0 && <button onClick={handleBulkDelete} className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-700"><Trash2 size={15} /> Delete {selected.length}</button>}</div>

    <div className="card overflow-hidden !p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1750px] text-sm"><thead className="sticky top-0 bg-ink-50 dark:bg-ink-800"><tr>{['', 'Lead / requirements', 'Mobile / WhatsApp', 'Email address', 'WhatsApp send', 'WhatsApp reply', 'Email send', 'Email reply', 'Last response', 'Site visits', 'Lead status', 'Score', 'Actions'].map((heading, index) => <th key={`${heading}-${index}`} className={`whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300 ${index === 0 ? 'w-10' : ''}`}>{heading}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={13} className="px-4 py-16 text-center text-ink-400">Loading contacts…</td></tr> : leads.length === 0 ? <tr><td colSpan={13} className="px-4 py-16 text-center"><Users size={30} className="mx-auto mb-2 text-ink-300" /><p className="font-semibold text-ink-600 dark:text-ink-300">{qualifiedOnly ? 'No qualified replies yet' : 'No contacts yet'}</p><p className="mt-1 text-sm text-ink-400">{qualifiedOnly ? 'Jab kisi lead ka WhatsApp ya email reply aayega, woh yahan dikhega.' : 'CSV / Excel upload karein ya contact manually add karein.'}</p></td></tr> : leads.map((lead) => <tr key={lead._id} className="border-t border-ink-100 align-top hover:bg-ink-50/60 dark:border-ink-800 dark:hover:bg-ink-800/40">
        <td className="px-3 py-3"><input aria-label={`Select ${lead.name}`} type="checkbox" checked={selected.includes(lead._id)} onChange={() => toggleSelect(lead._id)} /></td>
        <td className="max-w-[260px] px-3 py-3"><p className="font-semibold text-ink-900 dark:text-white">{lead.name || 'Unnamed lead'}</p><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{[lead.city, lead.location].filter(Boolean).join(' · ') || 'Location not added'}</p>{lead.requirements && <p title={lead.requirements} className="mt-1 max-w-[250px] truncate text-xs text-ink-400">{lead.requirements}</p>}</td>
        <td className="px-3 py-3 text-ink-600 dark:text-ink-300">{lead.phone || '—'}<div className="mt-1 text-[11px] text-ink-400">{lead.phone ? 'WhatsApp available' : 'Not provided'}</div></td>
        <td className="px-3 py-3 text-ink-600 dark:text-ink-300">{lead.email || '—'}<div className="mt-1 text-[11px] text-ink-400">{lead.email ? 'Email available' : 'Not provided'}</div></td>
        <td className="px-3 py-3"><MessageState state={lead.whatsappMessageStatus} sentAt={lead.whatsappSentAt} /></td>
        <td className="px-3 py-3"><div className="min-w-[130px]"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${lead.whatsappReplyAt ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'}`}>{lead.whatsappReplyAt ? `Reply · ${lead.whatsappReplyCount || 1}` : 'No reply'}</span><p className="mt-1 text-[11px] text-ink-400">{fmtDate(lead.whatsappReplyAt)}</p></div></td>
        <td className="px-3 py-3"><MessageState state={lead.emailMessageStatus} sentAt={lead.emailSentAt} /></td>
        <td className="px-3 py-3"><div className="min-w-[130px]"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${lead.emailReplyAt ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'}`}>{lead.emailReplyAt ? `Reply · ${lead.emailReplyCount || 1}` : 'No reply'}</span><p className="mt-1 text-[11px] text-ink-400">{fmtDate(lead.emailReplyAt)}</p></div></td>
        <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-500 dark:text-ink-400">{fmtDate(lead.lastReplyAt)}</td>
        <td className="px-3 py-3"><div className="min-w-[150px]"><span className="font-semibold text-ink-800 dark:text-ink-100">{lead.siteVisitCount || 0} visit(s)</span><p className="mt-1 text-[11px] capitalize text-ink-400">{lead.latestSiteVisit ? `${lead.latestSiteVisit.status?.replaceAll('_', ' ')} · ${lead.latestSiteVisit.preferredDate || ''}` : 'No visit booked'}</p></div></td>
        <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${STATUS_COLORS[lead.status] || 'bg-ink-100 text-ink-600'}`}>{String(lead.status || 'new').replaceAll('_', ' ')}</span></td>
        <td className="px-3 py-3 font-semibold text-ink-600 dark:text-ink-300">{lead.leadScore ?? 0}</td>
        <td className="px-3 py-3"><div className="flex gap-2"><button aria-label={`Edit ${lead.name}`} onClick={() => { setEditingLead(lead); setShowForm(true); }} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800"><Pencil size={15} /></button><button aria-label={`Delete ${lead.name}`} onClick={() => handleDelete(lead._id)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><Trash2 size={15} /></button></div></td>
      </tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 dark:border-ink-800"><p className="text-xs text-ink-500 dark:text-ink-400">Showing {leads.length ? (pagination.page - 1) * pagination.limit + 1 : 0}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} contacts</p><div className="flex items-center gap-2"><button disabled={pagination.page <= 1 || loading} onClick={() => fetchLeads(pagination.page - 1)} className="btn-secondary !px-3 !py-1.5 disabled:opacity-40">Previous</button><span className="text-xs text-ink-500 dark:text-ink-400">Page {pagination.page} / {pagination.totalPages}</span><button disabled={pagination.page >= pagination.totalPages || loading} onClick={() => fetchLeads(pagination.page + 1)} className="btn-secondary !px-3 !py-1.5 disabled:opacity-40">Next</button></div></div></div>

    {showForm && <LeadFormModal lead={editingLead} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchLeads(pagination.page); }} />}
    {showImport && <ImportLeadsModal onClose={() => setShowImport(false)} onImported={() => fetchLeads(1)} />}
  </div>;
}
