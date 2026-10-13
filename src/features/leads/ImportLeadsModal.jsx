import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Send,
  FileText,
  ClipboardPaste,
  MessageCircle,
  Mail,
  CalendarClock,
  Loader2,
} from 'lucide-react';
import { leadApi } from '../../api/leadApi.js';
import { campaignApi } from '../../api/outreachApi.js';

const DEFAULT_SUBJECT = 'Namaste {{firstName}}, aapki property requirement ke baare mein';
const DEFAULT_BODY =
  'Namaste {{name}},\n\nHum aapki property requirement samajhna chahte hain aur aapke liye best options share karna chahte hain.\n\nKya aap apna budget aur preferred location bata sakte hain? Aap is email ka reply kar sakte hain ya hume WhatsApp par message kar sakte hain.\n\nDhanyavaad';

const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const nowHHMM = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

function fmtDay(iso, hhmm, startsNow) {
  if (startsNow) return 'Right now';
  const d = new Date(`${iso}T${hhmm}:00+05:30`);
  return d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export default function ImportLeadsModal({ onClose, onImported }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('input'); // input | preview | settings | done
  const [tab, setTab] = useState('csv'); // csv | paste
  const [pasteText, setPasteText] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  // campaign settings
  const [name, setName] = useState(
    () => `Bulk upload ${new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}`,
  );
  const [useWhatsapp, setUseWhatsapp] = useState(true);
  const [useEmail, setUseEmail] = useState(false);
  const [limitMode, setLimitMode] = useState('daily'); // daily | all
  const [dailyLimit, setDailyLimit] = useState(50);
  const [sendTime, setSendTime] = useState('10:00');
  const [startDate, setStartDate] = useState(todayISO());
  const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY);

  const validRows = useMemo(() => rows.filter((r) => r.status === 'valid'), [rows]);
  const withEmail = useMemo(() => validRows.filter((r) => r.email).length, [validRows]);

  const loadPreview = (res) => {
    setRows(res.data.rows);
    setSummary(res.data.summary);
    // Email wali leads mili hain to email channel default on suggest karo
    setUseEmail(res.data.rows.some((r) => r.status === 'valid' && r.email));
    setStep('preview');
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      loadPreview(await leadApi.importPreview(file));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to parse CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleParseText = async () => {
    if (!pasteText.trim()) return;
    setError('');
    setLoading(true);
    try {
      loadPreview(await leadApi.importParseText(pasteText));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to read pasted leads');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- schedule preview (client side, backend wahi math karta hai) ---------- */
  const limit = limitMode === 'all' ? 0 : Math.max(1, Number(dailyLimit) || 1);
  const totalDays = limit ? Math.ceil(validRows.length / limit) : 1;
  const today = todayISO();
  const startsNow = limitMode === 'all' || (startDate === today && sendTime <= nowHHMM());
  const firstLabel = fmtDay(startDate, sendTime, startsNow);
  const lastLabel = limit ? fmtDay(addDays(startDate, totalDays - 1), sendTime, startsNow && totalDays === 1) : firstLabel;

  const settingsError = useMemo(() => {
    if (!name.trim()) return 'Campaign ka naam likho';
    if (!useWhatsapp && !useEmail) return 'Kam se kam ek channel chuno (WhatsApp ya Email)';
    if (useEmail && withEmail === 0) return 'Kisi bhi lead ke paas email nahi hai';
    if (useEmail && (!emailSubject.trim() || !emailBody.trim())) return 'Email subject aur body likho';
    if (limitMode === 'daily' && (!Number(dailyLimit) || Number(dailyLimit) < 1)) return 'Daily limit 1 ya usse zyada rakho';
    return '';
  }, [name, useWhatsapp, useEmail, withEmail, emailSubject, emailBody, limitMode, dailyLimit]);

  const handleLaunch = async () => {
    if (settingsError) return;
    setLoading(true);
    setError('');
    try {
      const res = await campaignApi.launch({
        rows: validRows,
        name: name.trim(),
        channels: { whatsapp: useWhatsapp, email: useEmail },
        dailyLimit: limit,
        sendTime,
        startDate,
        ...(useEmail ? { emailSubject: emailSubject.trim(), emailBody: emailBody.trim() } : {}),
      });
      setResult(res.data);
      setStep('done');
      onImported();
    } catch (err) {
      setError(err?.response?.data?.message || 'Campaign start nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  const badge = (status) => {
    if (status === 'valid') return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={12} /> valid</span>;
    if (status === 'duplicate') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><Copy size={12} /> duplicate</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={12} /> invalid</span>;
  };

  const tabBtn = (id, Icon, label) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        tab === id ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  const channelBox = (checked, onChange, Icon, title, desc, disabled) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
        checked ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-ink-200 dark:border-ink-700'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white"><Icon size={16} /> {title}</p>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{desc}</p>
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">
            {step === 'settings' ? 'Campaign settings' : 'Bulk add leads'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
        )}

        {/* ---------------- STEP 1: input ---------------- */}
        {step === 'input' && (
          <div>
            <div className="mb-4 flex gap-2">
              {tabBtn('csv', FileText, 'Upload CSV')}
              {tabBtn('paste', ClipboardPaste, 'Paste numbers')}
            </div>

            {tab === 'csv' && (
              <div
                onClick={() => fileRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                onDragOver={(e) => e.preventDefault()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 py-14 text-center hover:border-brand-500 dark:border-ink-700"
              >
                <UploadCloud size={36} className="mb-3 text-ink-400" />
                <p className="font-medium text-ink-700 dark:text-ink-200">{loading ? 'Parsing...' : 'Click or drag a CSV file here'}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                  Columns: Name, Phone (required) · Email (optional, email campaign ke liye)
                </p>
                <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => handleFile(e.target.files[0])} />
              </div>
            )}

            {tab === 'paste' && (
              <div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={10}
                  className="input-field font-mono text-xs"
                  placeholder={'Har line mein ek lead — name, number aur email kisi bhi order mein:\n\nRahul Sharma, 9876543210, rahul@gmail.com\n9876543211 | priya@example.com | Priya Singh\nAmit Verma 9812345678'}
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    Number aur email apne aap pehchane jate hain, baaki naam ban jata hai.
                  </p>
                  <button onClick={handleParseText} disabled={loading || !pasteText.trim()} className="btn-primary">
                    {loading ? 'Reading...' : 'Read leads'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- STEP 2: preview ---------------- */}
        {step === 'preview' && (
          <div>
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-ink-100 px-3 py-1 dark:bg-ink-800">Total: {summary.total}</span>
              <span className="rounded-lg bg-green-100 px-3 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300">Valid: {summary.valid}</span>
              <span className="rounded-lg bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Duplicate: {summary.duplicate}</span>
              <span className="rounded-lg bg-red-100 px-3 py-1 text-red-700 dark:bg-red-900/30 dark:text-red-300">Invalid: {summary.invalid}</span>
              <span className="rounded-lg bg-brand-100 px-3 py-1 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">With email: {withEmail}</span>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-ink-200 dark:border-ink-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-50 dark:bg-ink-800">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNumber} className="border-t border-ink-100 dark:border-ink-800">
                      <td className="px-3 py-2 text-ink-400">{r.rowNumber}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.phone}</td>
                      <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{r.email}</td>
                      <td className="px-3 py-2">{badge(r.status)}</td>
                      <td className="px-3 py-2 text-xs text-ink-500">{r.errors?.join(', ') || r.duplicateReason || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setStep('input')} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">Back</button>
              <button onClick={() => setStep('settings')} disabled={summary.valid === 0} className="btn-primary">
                Next: sending plan ({summary.valid} leads)
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 3: campaign settings ---------------- */}
        {step === 'settings' && (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-200">Campaign name</label>
              <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-200">Kahan bhejna hai?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {channelBox(useWhatsapp, setUseWhatsapp, MessageCircle, 'WhatsApp', `${validRows.length} leads ko opening message (pehle chalta hai)`, false)}
                {channelBox(useEmail, setUseEmail, Mail, 'Email', withEmail ? `${withEmail} leads ke paas email hai (WhatsApp ke baad chalta hai)` : 'Kisi lead ke paas email nahi hai', withEmail === 0)}
              </div>
            </div>

            <div className="rounded-xl border border-ink-200 p-4 dark:border-ink-700">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
                <CalendarClock size={16} /> Daily sending plan
              </p>

              <div className="mb-3 flex gap-2">
                <button onClick={() => setLimitMode('daily')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${limitMode === 'daily' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>
                  Per-day limit
                </button>
                <button onClick={() => setLimitMode('all')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${limitMode === 'all' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>
                  Send all now
                </button>
              </div>

              {limitMode === 'daily' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-300">Leads per day</label>
                    <input type="number" min={1} className="input-field" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[25, 50, 100, 200].map((n) => (
                        <button key={n} onClick={() => setDailyLimit(n)} className="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300">{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-300">Send time (IST)</label>
                    <input type="time" className="input-field" value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-300">Start date</label>
                    <input type="date" className="input-field" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value || today)} />
                  </div>
                </div>
              )}

              <div className="mt-3 rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                {limitMode === 'daily' ? (
                  <>
                    <b>{validRows.length}</b> leads → <b>{totalDays} day{totalDays > 1 ? 's' : ''}</b> ({limit}/day).
                    <br />
                    <span className="text-ink-500 dark:text-ink-400">First batch: {firstLabel} · Last batch: {lastLabel}</span>
                  </>
                ) : (
                  <>All <b>{validRows.length}</b> leads abhi queue mein jayengi aur ek-ek karke bheji jayengi.</>
                )}
              </div>
              {useWhatsapp && limit > 250 && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Dhyan rahe: Meta naye WhatsApp numbers par roz ke naye-conversations ki limit lagata hai (aksar 250/day se shuru). Isse zyada rakhoge to Meta errors aa sakte hain.
                </p>
              )}
              {useWhatsapp && limitMode === 'all' && validRows.length > 250 && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {validRows.length} leads ek saath bhejna risky hai — Meta ki daily limit/quality rating ke liye "Per-day limit" behtar hai.
                </p>
              )}
            </div>

            {useEmail && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-200">Email subject</label>
                  <input className="input-field" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-200">Email body</label>
                  <textarea rows={7} className="input-field" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} maxLength={5000} />
                  <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                    Placeholders: <code>{'{{name}}'}</code> <code>{'{{firstName}}'}</code> <code>{'{{phone}}'}</code>. Neeche ek "reply STOP" unsubscribe line apne aap judti hai.
                  </p>
                </div>
              </div>
            )}

            {settingsError && <p className="text-sm text-red-600 dark:text-red-400">{settingsError}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setStep('preview')} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">Back</button>
              <button onClick={handleLaunch} disabled={loading || Boolean(settingsError)} className="btn-primary gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {loading ? 'Starting...' : `Start campaign (${validRows.length} leads)`}
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 4: done ---------------- */}
        {step === 'done' && result && (
          <div className="py-8 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-green-600" />
            <p className="font-medium text-ink-900 dark:text-white">Campaign started</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-500 dark:text-ink-400">
              {result.insertedCount} leads saved
              {result.skipped ? `, ${result.skipped} duplicate skipped` : ''}.{' '}
              {result.queued.whatsapp > 0 && `${result.queued.whatsapp} WhatsApp`}
              {result.queued.whatsapp > 0 && result.queued.email > 0 && ' + '}
              {result.queued.email > 0 && `${result.queued.email} email`} scheduled over {result.totalDays} day{result.totalDays > 1 ? 's' : ''}.
              {result.withoutEmail > 0 && ` ${result.withoutEmail} leads ke paas email nahi tha, unhe sirf WhatsApp jayega.`}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">Close</button>
              <button
                onClick={() => { onClose(); navigate(result.queued.whatsapp > 0 ? '/outreach/whatsapp' : '/outreach/email'); }}
                className="btn-primary"
              >
                Watch live progress
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
