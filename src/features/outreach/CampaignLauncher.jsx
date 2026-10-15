import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, MessageCircle, Mail, Search, Send, X } from 'lucide-react';
import { leadApi } from '../../api/leadApi.js';
import { campaignApi } from '../../api/outreachApi.js';
import { whatsappApi } from '../../api/whatsappApi.js';
import { emailApi } from '../../api/emailApi.js';
import { Link } from 'react-router-dom';

function getTemplateVars(template) {
  const body = (template?.components || []).find((item) => String(item.type).toUpperCase() === 'BODY');
  const text = String(body?.text || '');
  const indexes = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1]));
  return [...new Set(indexes)].sort((a, b) => a - b);
}

function templateHasImageHeader(template) {
  const header = (template?.components || []).find((item) => String(item.type).toUpperCase() === 'HEADER');
  return String(header?.format || '').toUpperCase() === 'IMAGE';
}

function formatTemplatePreview(template) {
  return (template?.components || []).map((item) => item.text).filter(Boolean).join('\n\n') || 'Approved Meta template selected.';
}

export default function CampaignLauncher({ channel, onClose, onLaunched }) {
  const isWhatsApp = channel === 'whatsapp';
  const [campaignName, setCampaignName] = useState(`${isWhatsApp ? 'WhatsApp' : 'Email'} campaign ${new Date().toLocaleDateString('en-IN')}`);
  const [search, setSearch] = useState('');
  const [delivery, setDelivery] = useState('unsent');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState({});
  const [loadingRows, setLoadingRows] = useState(true);
  const [rowsError, setRowsError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [dailyLimit, setDailyLimit] = useState('100');
  const [sendTime, setSendTime] = useState('10:00');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [launchMessage, setLaunchMessage] = useState('');

  const selectedTemplate = useMemo(() => templates.find((item) => `${item.name}::${item.language}` === templateName) || null, [templates, templateName]);
  const selectedEmailTemplate = useMemo(() => emailTemplates.find((item) => String(item._id) === emailTemplateId) || null, [emailTemplates, emailTemplateId]);
  const variableIndexes = useMemo(() => getTemplateVars(selectedTemplate), [selectedTemplate]);
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const currentPageIds = rows.map((row) => row._id);
  const currentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selected[id]);

  const fetchRows = useCallback(async () => {
    setLoadingRows(true);
    setRowsError('');
    try {
      const response = await leadApi.list({
        page,
        limit: 30,
        ...(search.trim() ? { search: search.trim() } : {}),
        channel,
        delivery,
      });
      setRows(response.data.leads || []);
      setPagination(response.data.pagination || { page, total: 0, totalPages: 1 });
    } catch (err) {
      setRowsError(err?.response?.data?.message || 'Saved leads load nahi huin. Backend connection check karein.');
      setRows([]);
      setPagination({ page: 1, total: 0, totalPages: 1 });
    } finally {
      setLoadingRows(false);
    }
  }, [page, search, channel, delivery]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    if (isWhatsApp) return;
    let active = true;
    setTemplatesLoading(true);
    setTemplatesError('');
    emailApi.templates().then((response) => {
      if (!active) return;
      const items = response.data.templates || [];
      setEmailTemplates(items);
      if (!items.length) setTemplatesError('Abhi email template save nahi hai. Email dropdown ke Templates section mein pehle ek template bana lein.');
    }).catch((err) => {
      if (active) setTemplatesError(err?.response?.data?.message || 'Email templates load nahi hue. Backend connection check karein.');
    }).finally(() => { if (active) setTemplatesLoading(false); });
    return () => { active = false; };
  }, [isWhatsApp]);

  useEffect(() => {
    if (!selectedEmailTemplate) return;
    setEmailSubject(selectedEmailTemplate.subject || '');
    setEmailBody(selectedEmailTemplate.body || '');
  }, [selectedEmailTemplate]);

  useEffect(() => {
    if (!isWhatsApp) return;
    let active = true;
    setTemplatesLoading(true);
    setTemplatesError('');
    whatsappApi.templates().then((response) => {
      if (!active) return;
      const items = response.data.templates || [];
      setTemplates(items);
      if (items.length) setTemplateName(`${items[0].name}::${items[0].language}`);
      else setTemplatesError('Koi approved template nahi mila. Meta WhatsApp Manager mein template approve karein aur Business Account permissions check karein.');
    }).catch((err) => {
      if (active) setTemplatesError(err?.response?.data?.message || 'Approved templates load nahi hue. Meta API credentials check karein.');
    }).finally(() => { if (active) setTemplatesLoading(false); });
    return () => { active = false; };
  }, [isWhatsApp]);

  useEffect(() => { setPage(1); }, [search, delivery]);
  useEffect(() => { setTemplateVariables({}); setHeaderImageUrl(''); }, [templateName]);

  const toggleCurrentPage = () => setSelected((previous) => {
    const next = { ...previous };
    if (currentPageSelected) currentPageIds.forEach((id) => { delete next[id]; });
    else currentPageIds.forEach((id) => { next[id] = true; });
    return next;
  });

  const validate = () => {
    if (!campaignName.trim()) return 'Campaign name likhna zaroori hai.';
    if (!selectedIds.length) return 'Kam se kam ek lead select karein.';
    if (!dailyLimit || Number(dailyLimit) < 1 || Number(dailyLimit) > 5000 || !Number.isInteger(Number(dailyLimit))) return 'Daily limit 1 se 5000 ke beech whole number hona chahiye.';
    if (selectedIds.length > 5000) return 'Ek campaign mein maximum 5,000 leads select karein.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) return 'Send time HH:mm format mein hona chahiye.';
    if (!startDate) return 'Start date choose karein.';
    if (isWhatsApp) {
      if (!selectedTemplate) return 'Ek approved Meta template select karein.';
      if (templateHasImageHeader(selectedTemplate) && !headerImageUrl.trim()) return 'Is template ke image header ke liye public image URL required hai.';
      for (const index of variableIndexes) {
        const config = templateVariables[index] || { source: 'name', value: '' };
        if (config.source === 'static' && !String(config.value || '').trim()) return `Template variable {{${index}}} ki value fill karein.`;
      }
    } else {
      if (!selectedEmailTemplate) return 'Saved email template select karein.';
      if (!emailSubject.trim()) return 'Selected template ka subject missing hai.';
      if (!emailBody.trim()) return 'Selected template ka message missing hai.';
    }
    return '';
  };

  const launch = async (event) => {
    event.preventDefault();
    setLaunchError('');
    setLaunchMessage('');
    const validation = validate();
    if (validation) { setLaunchError(validation); return; }
    setLaunching(true);
    try {
      const payload = {
        name: campaignName.trim(),
        leadIds: selectedIds,
        channels: { whatsapp: isWhatsApp, email: !isWhatsApp },
        dailyLimit: Number(dailyLimit),
        sendTime,
        startDate,
      };
      if (isWhatsApp) {
        payload.whatsappTemplateName = selectedTemplate.name;
        payload.whatsappTemplateLanguage = selectedTemplate.language || 'en_US';
        payload.whatsappTemplateCategory = selectedTemplate.category || '';
        payload.whatsappTemplateHeaderImageUrl = headerImageUrl.trim();
        payload.whatsappTemplateVariables = variableIndexes.map((index) => ({
          index,
          source: templateVariables[index]?.source || 'name',
          value: templateVariables[index]?.value || '',
        }));
      } else {
        payload.emailTemplateId = selectedEmailTemplate._id;
        payload.emailSubject = emailSubject.trim();
        payload.emailBody = emailBody.trim();
      }
      const response = await campaignApi.launch(payload);
      const queued = response.data?.queued || {};
      const count = isWhatsApp ? queued.whatsapp : queued.email;
      setLaunchMessage(`${count || 0} ${isWhatsApp ? 'WhatsApp' : 'email'} messages queue mein add hue. Sending progress page par live update hogi.`);
      onLaunched?.();
      setTimeout(() => onClose?.(), 1000);
    } catch (err) {
      setLaunchError(err?.response?.data?.message || 'Campaign start nahi hui. Settings aur selected contacts check karein.');
    } finally {
      setLaunching(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !launching) onClose?.(); }}>
    <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900">
      <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-4 dark:border-ink-800 sm:p-5">
        <div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isWhatsApp ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>{isWhatsApp ? <MessageCircle size={21} /> : <Mail size={21} />}</span><div><h2 className="font-display text-xl font-bold text-ink-900 dark:text-white">Create {isWhatsApp ? 'WhatsApp' : 'Email'} campaign</h2><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Saved leads select karein. Data import aur message sending alag rakhe gaye hain.</p></div></div>
        <button disabled={launching} onClick={onClose} aria-label="Close campaign launcher" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"><X size={20} /></button>
      </div>

      <form onSubmit={launch} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {(launchError || rowsError || templatesError) && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><div>{launchError || rowsError || templatesError}</div></div>}
          {launchMessage && <div className="mb-4 flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{launchMessage}</div>}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="min-w-0 space-y-3">
              <div><label className="mb-1.5 block text-sm font-semibold text-ink-800 dark:text-ink-100">Campaign name</label><input className="input-field" maxLength={120} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Diwali property offer" /></div>
              <div className="flex flex-col gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-800 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Choose contacts</p><p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{pagination.total || 0} contacts match this filter · {selectedIds.length} selected across pages</p></div>
                <div className="inline-flex shrink-0 rounded-lg bg-ink-100 p-1 dark:bg-ink-800"><button type="button" onClick={() => { setDelivery('unsent'); setSelected({}); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${delivery === 'unsent' ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 dark:text-ink-300'}`}>Not sent yet</button><button type="button" onClick={() => { setDelivery('sent'); setSelected({}); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${delivery === 'sent' ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 dark:text-ink-300'}`}>Previously sent</button></div>
              </div>
              <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input-field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile or email" /></div>
              <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
                <table className="w-full min-w-[540px] text-sm">
                  <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-300"><tr><th className="w-10 px-3 py-2.5"><input type="checkbox" checked={currentPageSelected} onChange={toggleCurrentPage} aria-label="Select all contacts on this page" /></th><th className="px-3 py-2.5">Contact</th><th className="px-3 py-2.5">{isWhatsApp ? 'WhatsApp number' : 'Email address'}</th></tr></thead>
                  <tbody>{loadingRows ? <tr><td colSpan={3} className="px-3 py-10 text-center text-ink-400"><Loader2 size={22} className="mx-auto animate-spin" /><p className="mt-2 text-xs">Loading saved contacts…</p></td></tr> : rows.length === 0 ? <tr><td colSpan={3} className="px-3 py-8 text-center text-sm text-ink-500">No matching contacts. Upload data or change the filter.</td></tr> : rows.map((row) => <tr key={row._id} className="border-t border-ink-100 dark:border-ink-800"><td className="px-3 py-3"><input type="checkbox" checked={Boolean(selected[row._id])} onChange={() => setSelected((previous) => { const next = { ...previous }; if (next[row._id]) delete next[row._id]; else next[row._id] = true; return next; })} aria-label={`Select ${row.name}`} /></td><td className="px-3 py-3"><p className="font-semibold text-ink-900 dark:text-white">{row.name || 'New lead'}</p><p className="text-xs text-ink-500 dark:text-ink-400">{row.city || row.location || 'Location not set'}</p></td><td className="px-3 py-3 text-ink-600 dark:text-ink-300">{isWhatsApp ? row.phone : row.email}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-ink-500 dark:text-ink-400"><span>Page {pagination.page || page} of {pagination.totalPages || 1}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loadingRows} onClick={() => setPage((value) => value - 1)} className="btn-secondary !px-2 !py-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" disabled={page >= (pagination.totalPages || 1) || loadingRows} onClick={() => setPage((value) => value + 1)} className="btn-secondary !px-2 !py-1.5 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
            </section>

            <section className="space-y-4">
              {isWhatsApp ? <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
                <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-ink-900 dark:text-white">Step 2 · Approved Meta template</h3><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Template first message ke liye required hai.</p></div>{templatesLoading && <Loader2 size={17} className="animate-spin text-brand-600" />}</div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Choose template</label><select value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="input-field" disabled={templatesLoading || !templates.length}><option value="">Select an approved template</option>{templates.map((item) => <option key={`${item.name}::${item.language}`} value={`${item.name}::${item.language}`}>{item.name} · {item.language} · {item.category || 'Template'}</option>)}</select>
                {selectedTemplate && <div className="mt-3 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/70"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold uppercase text-green-700 dark:bg-green-900/40 dark:text-green-300">Approved</span><span className="rounded-full bg-ink-200 px-2 py-1 text-[10px] font-semibold text-ink-600 dark:bg-ink-700 dark:text-ink-300">{selectedTemplate.language}</span></div><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-ink-700 dark:text-ink-200">{formatTemplatePreview(selectedTemplate)}</pre></div>}
                {variableIndexes.length > 0 && <div className="mt-4 space-y-3"><p className="text-xs font-semibold text-ink-700 dark:text-ink-200">Template variables</p>{variableIndexes.map((index) => <div key={index} className="grid grid-cols-[100px_minmax(0,1fr)] gap-2"><div className="flex items-center text-xs font-semibold text-ink-500">{'{{'}{index}{'}}'}</div><div className="flex flex-col gap-2 sm:flex-row"><select className="input-field" value={templateVariables[index]?.source || 'name'} onChange={(e) => setTemplateVariables((previous) => ({ ...previous, [index]: { ...previous[index], source: e.target.value } }))}><option value="name">Lead name</option><option value="phone">Mobile number</option><option value="email">Email address</option><option value="static">Custom text</option></select>{templateVariables[index]?.source === 'static' && <input className="input-field" maxLength={1000} value={templateVariables[index]?.value || ''} onChange={(e) => setTemplateVariables((previous) => ({ ...previous, [index]: { ...previous[index], source: 'static', value: e.target.value } }))} placeholder="Variable value" />}</div></div>)}</div>}
                {selectedTemplate && templateHasImageHeader(selectedTemplate) && <div className="mt-3"><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Public image URL for header</label><input type="url" className="input-field" value={headerImageUrl} onChange={(e) => setHeaderImageUrl(e.target.value)} placeholder="https://.../property-offer.jpg" /><p className="mt-1 text-[11px] text-ink-400">Image must be publicly accessible over HTTPS.</p></div>}
              </div> : <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-ink-900 dark:text-white">Step 2 · Choose email template</h3><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Saved template ka content per-contact personalize hoga.</p></div><Link to="/email/templates" className="shrink-0 text-xs font-semibold text-brand-600 hover:underline">Manage templates</Link></div><label className="mb-1.5 mt-4 block text-xs font-semibold text-ink-600 dark:text-ink-300">Template</label><select className="input-field" value={emailTemplateId} onChange={(e) => setEmailTemplateId(e.target.value)} disabled={templatesLoading || !emailTemplates.length}><option value="">Select a saved email template</option>{emailTemplates.map((item) => <option key={item._id} value={item._id}>{item.name} · {item.category || 'General'}</option>)}</select>{selectedEmailTemplate ? <div className="mt-3 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/70"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Subject preview</p><p className="mt-1 text-sm font-semibold text-ink-800 dark:text-ink-100">{selectedEmailTemplate.subject}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-ink-400">Message preview</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-700 dark:text-ink-200">{selectedEmailTemplate.body}</p><p className="mt-2 text-[11px] text-ink-400">Variables such as {'{{name}}'} are filled per recipient.</p></div> : <div className="mt-3 rounded-lg border border-dashed border-ink-200 p-4 text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">{templatesLoading ? 'Loading saved email templates…' : 'Pehle Email → Templates mein reusable email template create karein.'}</div>}</div>}

              <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800"><h3 className="text-sm font-bold text-ink-900 dark:text-white">Queue & schedule</h3><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Messages are queued and processed one by one. Live progress will appear in this page.</p><div className="mt-3 grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Contacts per day</label><input type="number" min="1" max="5000" step="1" className="input-field" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} /><p className="mt-1 text-[10px] text-ink-400">Daily cap ke hisaab se queue paced rahegi.</p></div><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Start time (IST)</label><input type="time" className="input-field" value={sendTime} onChange={(e) => setSendTime(e.target.value)} /></div><div className="col-span-2"><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Start date</label><input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div></div></div>
            </section>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/70 px-4 py-3 dark:border-ink-800 dark:bg-ink-900 sm:px-5"><p className="text-xs text-ink-500 dark:text-ink-400"><b className="text-ink-800 dark:text-ink-100">{selectedIds.length}</b> selected · Upload data does not send automatically.</p><div className="flex gap-2"><button type="button" onClick={onClose} disabled={launching} className="btn-secondary">Cancel</button><button type="submit" disabled={launching || loadingRows || templatesLoading} className="btn-primary flex items-center gap-2 disabled:opacity-50">{launching ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{launching ? 'Adding to queue…' : 'Start campaign'}</button></div></div>
      </form>
    </div>
  </div>;
}
