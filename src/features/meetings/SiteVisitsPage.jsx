import { useEffect, useState, useCallback } from 'react';
import { Plus, MapPin, Trash2 } from 'lucide-react';
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

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await meetingApi.list({ ...(status ? { status } : {}), limit: 50 });
      setMeetings(res.data.meetings);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleStatusChange = async (id, newStatus) => {
    await meetingApi.update(id, { status: newStatus });
    fetchList();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this site visit?')) return;
    await meetingApi.remove(id);
    fetchList();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Site Visits</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Schedule Visit
        </button>
      </div>

      <div className="mt-4 flex gap-1">
        <button onClick={() => setStatus('')} className={`rounded-full px-3 py-1.5 text-xs font-medium ${!status ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${status === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="card mt-4 divide-y divide-ink-50 p-0 dark:divide-ink-800">
        {loading && <p className="p-4 text-sm text-ink-400">Loading…</p>}
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
                {m.leadId?.phone} · {m.preferredDate} at {m.preferredTime}
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

      {showModal && <ScheduleVisitModal onClose={() => setShowModal(false)} onSaved={fetchList} />}
    </div>
  );
}