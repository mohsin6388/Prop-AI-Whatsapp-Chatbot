import { useEffect, useState, useCallback } from 'react';
import { Plus, MapPin, Trash2, CalendarClock, CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { meetingApi } from '../../api/meetingApi.js';
import ScheduleVisitModal from './ScheduleVisitModal.jsx';

const STATUSES = ['scheduled', 'visited', 'not_visited', 'rescheduled', 'cancelled'];

const STATUS_COLORS = {
  scheduled: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  visited: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  not_visited: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  rescheduled: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  cancelled: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function SiteVisitsPage() {
  const [meetings, setMeetings] = useState([]);
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ total: 0, scheduled: 0, visited: 0, notVisited: 0, rescheduled: 0, cancelled: 0 });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await meetingApi.list({ ...(status ? { status } : {}), page, limit: 50 });
      setMeetings(res.data.meetings || []);
      setSummary(res.data.summary || { total: 0, scheduled: 0, visited: 0, notVisited: 0, rescheduled: 0, cancelled: 0 });
      setPagination(res.data.pagination || { page, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err?.response?.data?.message || 'Site visits load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleStatusChange = async (id, newStatus) => {
    setError('');
    try { await meetingApi.update(id, { status: newStatus }); await fetchList(); }
    catch (err) { setError(err?.response?.data?.message || 'Visit status update nahi ho paaya'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this site visit?')) return;
    setError('');
    try { await meetingApi.remove(id); await fetchList(); }
    catch (err) { setError(err?.response?.data?.message || 'Site visit delete nahi ho paaya'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Site Visits</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Schedule Visit
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ['Total visits', summary.total, CalendarClock, 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300'],
          ['Scheduled', summary.scheduled, CalendarClock, 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300'],
          ['Visited', summary.visited, CheckCircle2, 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300'],
          ['Not visited', summary.notVisited, AlertCircle, 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'],
          ['Rescheduled', summary.rescheduled, CalendarClock, 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'],
          ['Cancelled', summary.cancelled, XCircle, 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'],
        ].map(([label, value, Icon, tone]) => <div key={label} className="card !p-3"><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon size={16}/></span><div><p className="text-[11px] text-ink-500 dark:text-ink-400">{label}</p><p className="text-lg font-bold text-ink-900 dark:text-white">{Number(value || 0).toLocaleString('en-IN')}</p></div></div></div>)}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      <div className="mt-4 flex flex-wrap gap-1">
        <button onClick={() => { setStatus(''); setPage(1); }} className={`rounded-full px-3 py-1.5 text-xs font-medium ${!status ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${status === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="card mt-4 divide-y divide-ink-50 p-0 dark:divide-ink-800">
        {loading && <div className="p-6 text-center text-sm text-ink-400"><Loader2 className="mx-auto animate-spin" size={22}/><p className="mt-2">Loading site visits…</p></div>}
        {!loading && meetings.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-400">Koi site visit nahi hai</p>
        )}
        {meetings.map((m) => (
          <div key={m._id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink-900 dark:text-white">{m.leadId?.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_COLORS[m.status]}`}>
                  {m.status.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                {[m.leadId?.phone, m.leadId?.email].filter(Boolean).join(' · ') || 'No phone/email'} · {m.preferredDate} at {m.preferredTime}
              </p>
              {m.propertyId && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
                  <MapPin size={11} /> {m.propertyId.projectName}
                </p>
              )}
              {m.notes && <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{m.notes}</p>}
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              <select
                value={m.status}
                onChange={(e) => handleStatusChange(m._id, e.target.value)}
                className="rounded-lg border border-ink-200 px-2 py-1 text-xs dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <button onClick={() => handleDelete(m._id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {pagination.total > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-900">
          <p className="text-xs text-ink-500 dark:text-ink-400">Showing {(pagination.page - 1) * 50 + 1}–{Math.min(pagination.page * 50, pagination.total)} of {pagination.total} visits</p>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-ink-200 px-3 py-2 text-xs disabled:opacity-40 dark:border-ink-700">Previous</button>
            <span className="text-xs text-ink-500 dark:text-ink-400">Page {pagination.page || 1} of {pagination.totalPages || 1}</span>
            <button disabled={page >= (pagination.totalPages || 1) || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-ink-200 px-3 py-2 text-xs disabled:opacity-40 dark:border-ink-700">Next</button>
          </div>
        </div>
      )}

      {showModal && <ScheduleVisitModal onClose={() => setShowModal(false)} onSaved={fetchList} />}
    </div>
  );
}