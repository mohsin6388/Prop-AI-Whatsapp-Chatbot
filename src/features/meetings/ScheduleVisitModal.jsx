import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { meetingApi } from '../../api/meetingApi.js';
import { leadApi } from '../../api/leadApi.js';
import { propertyApi } from '../../api/propertyApi.js';

export default function ScheduleVisitModal({ onClose, onSaved }) {
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState({ leadId: '', propertyId: '', preferredDate: '', preferredTime: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    leadApi.list({ limit: 100 }).then((r) => setLeads(r.data.leads));
    propertyApi.list({ limit: 100 }).then((r) => setProperties(r.data.properties));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await meetingApi.create({ ...form, propertyId: form.propertyId || undefined });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 dark:bg-ink-900">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">Schedule Site Visit</h2>
          <button onClick={onClose}><X size={18} className="text-ink-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <select required value={form.leadId} onChange={(e) => setForm((f) => ({ ...f, leadId: e.target.value }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white">
            <option value="">Select lead…</option>
            {leads.map((l) => <option key={l._id} value={l._id}>{l.name} — {l.phone}</option>)}
          </select>

          <select value={form.propertyId} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white">
            <option value="">Property (optional)…</option>
            {properties.map((p) => <option key={p._id} value={p._id}>{p.projectName}</option>)}
          </select>

          <div className="flex gap-2">
            <input type="date" required value={form.preferredDate}
              onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))}
              className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white" />
            <input type="time" required value={form.preferredTime}
              onChange={(e) => setForm((f) => ({ ...f, preferredTime: e.target.value }))}
              className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white" />
          </div>

          <textarea placeholder="Notes (optional)" rows={2} value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white" />

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Scheduling…' : 'Schedule Visit'}
          </button>
        </form>
      </div>
    </div>
  );
}