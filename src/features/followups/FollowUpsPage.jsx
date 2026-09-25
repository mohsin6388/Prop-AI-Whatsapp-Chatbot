import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, SkipForward, Pencil, Save, X, Phone, Trash2 } from 'lucide-react';
import { followUpApi } from '../../api/followUpApi.js';

const STATUS_TABS = ['pending', 'sent', 'done', 'skipped'];

const URGENCY_COLORS = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
};

export default function FollowUpsPage() {
  const [status, setStatus] = useState('pending');
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editMessage, setEditMessage] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await followUpApi.list({ status, limit: 50 });
      setFollowUps(res.data.followUps);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAction = async (id, newStatus) => {
    await followUpApi.update(id, { status: newStatus });
    fetchList();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this follow-up? This cannot be undone.')) return;
    await followUpApi.remove(id);
    fetchList();
  };

  const startEdit = (f) => {
    setEditingId(f._id);
    setEditDate(new Date(f.nextFollowUpDate).toISOString().slice(0, 16));
    setEditMessage(f.nextFollowUpMessage);
  };

  const saveEdit = async (id) => {
    await followUpApi.update(id, { nextFollowUpDate: editDate, nextFollowUpMessage: editMessage });
    setEditingId(null);
    fetchList();
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Follow Ups</h1>

      <div className="mt-4 flex gap-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
              status === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card mt-4 divide-y divide-ink-50 p-0 dark:divide-ink-800">
        {loading && <p className="p-4 text-sm text-ink-400">Loading…</p>}
        {!loading && followUps.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-400">Is status ke liye koi follow-up nahi hai</p>
        )}

        {followUps.map((f) => (
          <div key={f._id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900 dark:text-white">{f.leadId?.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${URGENCY_COLORS[f.urgency]}`}>
                    {f.urgency}
                  </span>
                  {f.buyingProbability != null && (
                    <span className="text-[10px] text-ink-400">· {f.buyingProbability}% buying chance</span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
                  <Phone size={11} /> {f.leadId?.phone} · Due {new Date(f.nextFollowUpDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>

                {editingId === f._id ? (
                  <div className="mt-2 space-y-2">
                    <input
                      type="datetime-local"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="rounded-lg border border-ink-200 px-2 py-1 text-xs dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                    />
                    <textarea
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(f._id)} className="btn-primary flex items-center gap-1 px-3 py-1 text-xs">
                        <Save size={12} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary flex items-center gap-1 px-3 py-1 text-xs">
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg bg-ink-50 p-2 text-sm text-ink-700 dark:bg-ink-800/50 dark:text-ink-300">
                    {f.nextFollowUpMessage}
                  </p>
                )}
              </div>

              {editingId !== f._id && (
                <div className="flex flex-shrink-0 gap-1.5">
                  {status === 'pending' && (
                    <>
                      <button onClick={() => startEdit(f)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleAction(f._id, 'done')} className="rounded-lg p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" title="Mark done">
                        <CheckCircle2 size={15} />
                      </button>
                      <button onClick={() => handleAction(f._id, 'skipped')} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" title="Skip">
                        <SkipForward size={15} />
                      </button>
                    </>
                  )}
                  <button onClick={() => handleDelete(f._id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}