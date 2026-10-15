import { useMemo, useRef, useState } from 'react';
import { X, UploadCloud, CheckCircle2, AlertTriangle, Copy, FileSpreadsheet, Loader2, ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { leadApi } from '../../api/leadApi.js';

export default function ImportLeadsModal({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const validRows = useMemo(() => rows.filter((row) => row.status === 'valid'), [rows]);

  const handleFile = async (file) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
      setError('CSV ya Excel Workbook (.xlsx) upload karein. Purani .xls file ko pehle .xlsx mein save karein.');
      return;
    }
    setError('');
    setLoading(true);
    setFileName(file.name);
    try {
      const response = await leadApi.importPreview(file);
      setRows(response.data.rows || []);
      setSummary(response.data.summary || {});
      setStep('preview');
    } catch (err) {
      setError(err?.response?.data?.message || 'File parse nahi ho paayi. Header row aur file format check karein.');
    } finally {
      setLoading(false);
    }
  };

  const importRows = async () => {
    if (!validRows.length || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await leadApi.importConfirm(validRows.map(({ status, errors, isDuplicate, duplicateReason, rowNumber, ...row }) => row));
      setResult(response.data || {});
      setStep('done');
      onImported?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Data import nahi ho saka. Duplicate rows ya required fields check karein.');
    } finally {
      setLoading(false);
    }
  };

  const badge = (status) => {
    const style = status === 'valid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : status === 'duplicate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    const Icon = status === 'valid' ? CheckCircle2 : status === 'duplicate' ? Copy : AlertTriangle;
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${style}`}><Icon size={12} />{status}</span>;
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5">
    <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900">
      <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800 sm:px-6">
        <div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Leads workspace</p><h2 className="mt-1 font-display text-xl font-bold text-ink-900 dark:text-white">{step === 'upload' ? 'Upload lead data' : step === 'preview' ? 'Review your data' : 'Import complete'}</h2><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Upload saves contacts only. No WhatsApp or email is sent until you launch a campaign.</p></div>
        <button onClick={onClose} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-800 dark:hover:bg-ink-800 dark:hover:text-white" aria-label="Close import"><X size={20} /></button>
      </div>

      {error && <div role="alert" className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 sm:mx-6">{error}</div>}

      {step === 'upload' && <div className="overflow-y-auto p-5 sm:p-6">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={loading} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }} className="flex min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 p-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-60 dark:border-ink-700 dark:bg-ink-800/40 dark:hover:bg-ink-800">
          {loading ? <Loader2 size={35} className="animate-spin text-brand-600" /> : <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200"><FileSpreadsheet size={27} /></span>}
          <p className="font-semibold text-ink-900 dark:text-white">{loading ? 'Reading your file…' : 'Choose CSV or Excel file'}</p><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Click to browse, or drag your file here</p><span className="mt-3 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">.csv · .xlsx</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800"><h3 className="text-sm font-semibold text-ink-900 dark:text-white">Required contact rule</h3><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Har row mein <b>Name optional</b> hai. Mobile/WhatsApp number ya Email mein se kam-se-kam ek hona chahiye. Dono bhi ho sakte hain.</p></div>
          <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800"><h3 className="text-sm font-semibold text-ink-900 dark:text-white">Supported columns</h3><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Name, Mobile/Phone/WhatsApp, Email, City, Location, Budget, Requirements, Notes. Header names thode alag hon to bhi common aliases pehchane jaate hain.</p></div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-400">File size limit: 15 MB. Excel format `.xlsx` hona chahiye.</p><button onClick={onClose} className="btn-secondary">Cancel</button></div>
      </div>}

      {step === 'preview' && <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid grid-cols-2 gap-3 border-b border-ink-100 p-5 dark:border-ink-800 sm:grid-cols-4 sm:px-6">{[['Rows found', summary?.total], ['Ready to import', summary?.valid], ['Duplicates', summary?.duplicate], ['Needs attention', summary?.invalid]].map(([label, value]) => <div key={label} className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60"><p className="text-xs text-ink-500 dark:text-ink-400">{label}</p><p className="mt-1 font-display text-xl font-bold text-ink-900 dark:text-white">{Number(value || 0).toLocaleString('en-IN')}</p></div>)}</div>
        <div className="border-b border-ink-100 px-5 py-3 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400 sm:px-6">File: <b className="text-ink-700 dark:text-ink-200">{fileName}</b>. Invalid rows and duplicates are skipped. You can import the valid contacts only.</div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-3 sm:px-6"><table className="w-full min-w-[800px] text-sm"><thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-ink-400 dark:bg-ink-900"><tr>{['Row', 'Name', 'Mobile / WhatsApp', 'Email', 'Status', 'Note'].map((title) => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.rowNumber}-${row.email}-${row.phone}`} className="border-t border-ink-100 dark:border-ink-800"><td className="px-3 py-3 text-ink-400">{row.rowNumber}</td><td className="px-3 py-3 font-medium text-ink-800 dark:text-ink-100">{row.name || '—'}</td><td className="px-3 py-3">{row.phone || '—'}</td><td className="px-3 py-3 text-ink-600 dark:text-ink-300">{row.email || '—'}</td><td className="px-3 py-3">{badge(row.status)}</td><td className="max-w-[280px] px-3 py-3 text-xs text-ink-500">{row.errors?.join(', ') || row.duplicateReason || '—'}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="py-12 text-center text-sm text-ink-400">No rows detected. Check the first row for column headers.</div>}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 p-5 dark:border-ink-800 sm:px-6"><p className="text-sm text-ink-500 dark:text-ink-400">{validRows.length} contacts will be saved. <b>No messages will be sent.</b></p><div className="flex gap-2"><button onClick={() => { setStep('upload'); setRows([]); setSummary(null); setError(''); }} className="btn-secondary flex items-center gap-1.5"><ArrowLeft size={15} /> Choose another file</button><button onClick={importRows} disabled={!validRows.length || loading} className="btn-primary flex items-center gap-2">{loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}{loading ? 'Importing…' : `Import ${validRows.length} contacts`}</button></div></div>
      </div>}

      {step === 'done' && <div className="p-8 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={32} /></span><h3 className="mt-4 font-display text-xl font-bold text-ink-900 dark:text-white">Your data is imported</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500 dark:text-ink-400"><b>{Number(result?.insertedCount || 0).toLocaleString('en-IN')}</b> contacts saved{result?.skipped ? `, ${result.skipped} duplicates skipped` : ''}. Head to WhatsApp or Email when you are ready to launch a campaign.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button onClick={onClose} className="btn-secondary">Close</button><button onClick={() => { onClose(); window.location.assign('/outreach/whatsapp'); }} className="btn-primary flex items-center gap-2"><Users size={16} /> Go to campaigns</button></div></div>}
    </div>
  </div>;
}
