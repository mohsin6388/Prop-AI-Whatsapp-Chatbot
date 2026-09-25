import { useEffect, useState, useCallback } from 'react';
import { Plus, Upload, Search, Trash2, Pencil, Download, Send } from 'lucide-react';
import { leadApi } from '../../api/leadApi.js';
import LeadFormModal from './LeadFormModal.jsx';
import ImportLeadsModal from './ImportLeadsModal.jsx';

const STATUSES = ['new', 'contacted', 'qualified', 'hot', 'warm', 'cold', 'site_visit', 'closed', 'lost'];

const STATUS_COLORS = {
  new: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300',
  hot: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  warm: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  cold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  contacted: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  site_visit: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  closed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [startingIds, setStartingIds] = useState([]); // leadIds currently being started (per-row spinner)

  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await leadApi.list({
        page, limit: 20,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      setLeads(res.data.leads);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { fetchLeads(1); }, [fetchLeads]);

  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await leadApi.remove(id);
    fetchLeads(pagination.page);
  };

  const handleBulkDelete = async () => {
    if (!selected.length || !confirm(`Delete ${selected.length} leads?`)) return;
    await leadApi.bulkDelete(selected);
    setSelected([]);
    fetchLeads(1);
  };

  const handleStart = async (leadIds) => {
    setStartingIds((s) => [...s, ...leadIds]);
    try {
      await leadApi.startConversations(leadIds);
      setSelected((s) => s.filter((id) => !leadIds.includes(id)));
      fetchLeads(pagination.page);
    } finally {
      setStartingIds((s) => s.filter((id) => !leadIds.includes(id)));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Leads</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">
            <Download size={16} /> Import CSV
          </button>
          <a href={leadApi.exportUrl()} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">
            <Upload size={16} />  Export
          </a>
          <button onClick={() => { setEditingLead(null); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus size={16} /> Add Lead
          </button>
        </div>
      </div>

      <div className="card mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, notes, requirements..."
            className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        {selected.length > 0 && (
          <>
            <button
              onClick={() => handleStart(selected)}
              disabled={selected.some((id) => startingIds.includes(id))}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Send size={16} /> Start {selected.length}
            </button>
            <button onClick={handleBulkDelete} className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
              <Trash2 size={16} /> Delete {selected.length}
            </button>
          </>
        )}
      </div>

      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 dark:bg-ink-800">
            <tr>
              <th className="w-10 px-3 py-3"></th>
              <th className="px-3 py-3 text-left font-medium text-ink-500 dark:text-ink-400">Name</th>
              <th className="px-3 py-3 text-left font-medium text-ink-500 dark:text-ink-400">Phone</th>
              <th className="px-3 py-3 text-left font-medium text-ink-500 dark:text-ink-400">City</th>
              <th className="px-3 py-3 text-left font-medium text-ink-500 dark:text-ink-400">Budget</th>
              <th className="px-3 py-3 text-left font-medium text-ink-500 dark:text-ink-400">Status</th>
              <th className="px-3 py-3 text-left font-medium text-ink-500 dark:text-ink-400">Score</th>
              <th className="px-3 py-3 text-right font-medium text-ink-500 dark:text-ink-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-ink-400">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-ink-400">No leads yet. Add one or import a CSV.</td></tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead._id} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.includes(lead._id)} onChange={() => toggleSelect(lead._id)} />
                  </td>
                  <td className="px-3 py-3 font-medium text-ink-900 dark:text-white">{lead.name}</td>
                  <td className="px-3 py-3 text-ink-600 dark:text-ink-300">{lead.phone}</td>
                  <td className="px-3 py-3 text-ink-600 dark:text-ink-300">{lead.city || '—'}</td>
                  <td className="px-3 py-3 text-ink-600 dark:text-ink-300">
                    {lead.budgetMin || lead.budgetMax
                      ? `₹${(lead.budgetMin ?? 0).toLocaleString('en-IN')} - ₹${(lead.budgetMax ?? 0).toLocaleString('en-IN')}`
                      : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status] || ''}`}>
                      {lead.status.replace('_', ' ')}
                    </span>
                    {!lead.conversationStarted && (
                      <span className="ml-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Not started
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-ink-600 dark:text-ink-300">{lead.leadScore ?? 0}</td>
                  <td className="px-3 py-3 text-right">
                    {!lead.conversationStarted && (
                      <button
                        onClick={() => handleStart([lead._id])}
                        disabled={startingIds.includes(lead._id)}
                        title="Start WhatsApp conversation"
                        className="mr-2 text-ink-400 hover:text-brand-600 disabled:opacity-50"
                      >
                        <Send size={16} />
                      </button>
                    )}
                    <button onClick={() => { setEditingLead(lead); setShowForm(true); }} className="mr-2 text-ink-400 hover:text-brand-600">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(lead._id)} className="text-ink-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchLeads(pagination.page - 1)}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-ink-700"
          >
            Prev
          </button>
          <span className="text-sm text-ink-500 dark:text-ink-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchLeads(pagination.page + 1)}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-ink-700"
          >
            Next
          </button>
        </div>
      )}

      {showForm && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchLeads(pagination.page); }}
        />
      )}
      {showImport && (
        <ImportLeadsModal
          onClose={() => setShowImport(false)}
          onImported={() => fetchLeads(1)}
        />
      )}
    </div>
  );
}