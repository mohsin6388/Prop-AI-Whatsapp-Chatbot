import { useState, useRef } from 'react';
import { X, UploadCloud, CheckCircle2, AlertTriangle, Copy } from 'lucide-react';
import { propertyApi } from '../../api/propertyApi.js';

export default function ImportPropertiesModal({ onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const res = await propertyApi.importPreview(file);
      setRows(res.data.rows);
      setSummary(res.data.summary);
      setStep('preview');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to parse CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const validRows = rows.filter((r) => r.status === 'valid');
    if (!validRows.length) return;
    setLoading(true);
    setError('');
    try {
      const res = await propertyApi.importConfirm(validRows);
      setResult(res.data);
      setStep('done');
      onImported();
    } catch (err) {
      setError(err?.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const badge = (status) => {
    if (status === 'valid') return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={12} /> valid</span>;
    if (status === 'duplicate') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><Copy size={12} /> duplicate</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={12} /> invalid</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Import Properties from CSV</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            onDragOver={(e) => e.preventDefault()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 py-16 text-center hover:border-brand-500 dark:border-ink-700"
          >
            <UploadCloud size={36} className="mb-3 text-ink-400" />
            <p className="font-medium text-ink-700 dark:text-ink-200">
              {loading ? 'Parsing...' : 'Click or drag a CSV file here'}
            </p>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Needs at least a "Project Name" column. Also supports Builder, Type, BHK,
              Location, City, Budget (or Budget Min/Max), Size, Amenities, Parking,
              RERA Number, Nearby Metro/School/Hospital, Maps Link, Description, Images.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div className="mb-3 flex gap-3 text-sm">
              <span className="rounded-lg bg-ink-100 px-3 py-1 dark:bg-ink-800">Total: {summary.total}</span>
              <span className="rounded-lg bg-green-100 px-3 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300">Valid: {summary.valid}</span>
              <span className="rounded-lg bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Duplicate: {summary.duplicate}</span>
              <span className="rounded-lg bg-red-100 px-3 py-1 text-red-700 dark:bg-red-900/30 dark:text-red-300">Invalid: {summary.invalid}</span>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-ink-200 dark:border-ink-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-50 dark:bg-ink-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2 text-left">City</th>
                    <th className="px-3 py-2 text-left">BHK</th>
                    <th className="px-3 py-2 text-left">Budget</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNumber} className="border-t border-ink-100 dark:border-ink-800">
                      <td className="px-3 py-2 text-ink-400">{r.rowNumber}</td>
                      <td className="px-3 py-2">{r.projectName}</td>
                      <td className="px-3 py-2">{r.city}</td>
                      <td className="px-3 py-2">{r.bhk}</td>
                      <td className="px-3 py-2">
                        {r.budgetMin || r.budgetMax ? `${r.budgetMin ?? '?'} - ${r.budgetMax ?? '?'}` : '-'}
                      </td>
                      <td className="px-3 py-2">{badge(r.status)}</td>
                      <td className="px-3 py-2 text-xs text-ink-500">
                        {r.errors?.join(', ') || r.duplicateReason || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setStep('upload')} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || summary.valid === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Importing...' : `Import ${summary.valid} valid properties`}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-10 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-green-600" />
            <p className="font-medium text-ink-900 dark:text-white">
              Imported {result.insertedCount} properties
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
              These properties are now live in your inventory and the AI will start
              recommending them to matching buyers on WhatsApp.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={onClose} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
