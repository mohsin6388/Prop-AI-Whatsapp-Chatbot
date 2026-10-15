import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, FileText, Loader2, Mail, MessageCircle, Plus, RefreshCw, Save, Send, Trash2, X } from 'lucide-react';
import { whatsappApi } from '../../api/whatsappApi.js';
import { emailApi } from '../../api/emailApi.js';

const EMAIL_CATEGORIES = [
  { value: 'marketing', label: 'Marketing' }, { value: 'follow_up', label: 'Follow-up' },
  { value: 'property_update', label: 'Property update' }, { value: 'general', label: 'General' },
];

function StatusBadge({ status }) {
  const value = String(status || 'unknown').toUpperCase();
  const styles = value === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    : value === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : ['PENDING', 'IN_APPEAL'].includes(value) ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles}`}>{value.replaceAll('_', ' ')}</span>;
}

export default function TemplateManagerPage({ channel = 'email' }) {
  const isWhatsApp = channel === 'whatsapp';
  const navigate = useNavigate();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [formOpen, setFormOpen] = useState(false); const [editingId, setEditingId] = useState('');
  const [name, setName] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [emailCategory, setEmailCategory] = useState('marketing');
  const [waCategory, setWaCategory] = useState('MARKETING'); const [language, setLanguage] = useState('en_US'); const [headerText, setHeaderText] = useState(''); const [footerText, setFooterText] = useState(''); const [sampleValues, setSampleValues] = useState('Mohsin, Noida');

  const resetForm = () => { setEditingId(''); setName(''); setSubject(''); setBody(''); setEmailCategory('marketing'); setWaCategory('MARKETING'); setLanguage('en_US'); setHeaderText(''); setFooterText(''); setSampleValues('Mohsin, Noida'); };
  const loadItems = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = isWhatsApp ? await whatsappApi.allTemplates() : await emailApi.templates(); setItems(response.data?.templates || []); }
    catch (err) { setError(err?.response?.data?.message || (isWhatsApp ? 'Meta templates load nahi hue. Access token, WABA ID aur whatsapp_business_management permission check karein.' : 'Email templates load nahi hue. Backend connection check karein.')); setItems([]); }
    finally { setLoading(false); }
  }, [isWhatsApp]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const openCreate = () => { resetForm(); setError(''); setNotice(''); setFormOpen(true); };
  const openEdit = (template) => { setError(''); setNotice(''); setEditingId(template._id); setName(template.name || ''); setSubject(template.subject || ''); setBody(template.body || ''); setEmailCategory(template.category || 'marketing'); setFormOpen(true); };

  const saveEmail = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    if (!name.trim() || !subject.trim() || !body.trim()) { setError('Template name, subject aur message tino required hain.'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), subject: subject.trim(), body: body.trim(), category: emailCategory };
      if (editingId) await emailApi.updateTemplate(editingId, payload); else await emailApi.createTemplate(payload);
      setNotice(editingId ? 'Email template update ho gaya.' : 'Email template save ho gaya. Ab Bulk Email mein select kar sakte ho.'); setFormOpen(false); resetForm(); await loadItems();
    } catch (err) { setError(err?.response?.data?.message || 'Email template save nahi hua.'); } finally { setSaving(false); }
  };

  const submitWhatsApp = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    if (!name.trim() || !body.trim()) { setError('Template name aur message body required hain.'); return; }
    const vars = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])); const max = vars.length ? Math.max(...vars) : 0;
    const samples = sampleValues.split(',').map((v) => v.trim()).filter(Boolean);
    if (max && samples.length < max) { setError(`Body mein {{1}} se {{${max}}} variables hain. ${max} sample values comma se separate karke do.`); return; }
    setSaving(true);
    try {
      const response = await whatsappApi.createTemplate({ name: name.trim().toLowerCase(), category: waCategory, language, bodyText: body.trim(), headerText: headerText.trim(), footerText: footerText.trim(), sampleValues: samples });
      setNotice(response.message || 'Template Meta ko review ke liye submit ho gaya. Approval ke baad Refresh karein.'); setFormOpen(false); resetForm(); await loadItems();
    } catch (err) { setError(err?.response?.data?.message || 'Template Meta ko submit nahi ho paya. Name, sample values aur permissions check karein.'); } finally { setSaving(false); }
  };

  const deleteEmail = async (template) => {
    if (!confirm(`Delete email template "${template.name}"? Existing campaigns ka saved content safe rahega.`)) return;
    setDeletingId(template._id); setError(''); setNotice('');
    try { await emailApi.deleteTemplate(template._id); setNotice('Template delete ho gaya.'); await loadItems(); }
    catch (err) { setError(err?.response?.data?.message || 'Template delete nahi hua.'); } finally { setDeletingId(''); }
  };

  const Icon = isWhatsApp ? MessageCircle : Mail;
  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${isWhatsApp ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}><Icon size={22}/></span><div><h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">{isWhatsApp ? 'WhatsApp Templates' : 'Email Templates'}</h1><p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{isWhatsApp ? 'Create templates and track Meta approval.' : 'Save reusable email content for bulk campaigns.'}</p></div></div><div className="flex gap-2"><button type="button" onClick={loadItems} disabled={loading} className="btn-secondary inline-flex items-center gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Refresh</button><button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2"><Plus size={16}/>Create template</button></div></div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertCircle size={17} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/><span>{notice}</span></div>}
    {isWhatsApp && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Meta template ko review karta hai. Sirf <b>APPROVED</b> templates Bulk Messages ke dropdown mein available honge; Pending/Rejected templates yahan status ke saath dikhenge.</div>}

    {formOpen && <section className="card !p-4 sm:!p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">{isWhatsApp ? 'Submit WhatsApp template' : editingId ? 'Edit email template' : 'Create email template'}</h2><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{isWhatsApp ? 'Template Meta Business Account par submit hoga.' : 'Save hone ke baad Bulk Email mein choose kar sakte ho.'}</p></div><button type="button" onClick={() => { setFormOpen(false); resetForm(); }} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Close template form"><X size={18}/></button></div>
      <form onSubmit={isWhatsApp ? submitWhatsApp : saveEmail} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Template name</label><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={isWhatsApp ? 120 : 100} placeholder={isWhatsApp ? 'property_offer_2026' : 'New property offer'} required/><p className="mt-1 text-[11px] text-ink-400">{isWhatsApp ? 'Lowercase letters, numbers, underscores.' : 'CRM mein template ka naam.'}</p></div>
      {isWhatsApp ? <div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Category</label><select className="input-field" value={waCategory} onChange={(e) => setWaCategory(e.target.value)}><option value="MARKETING">Marketing</option><option value="UTILITY">Utility</option></select></div> : <div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Category</label><select className="input-field" value={emailCategory} onChange={(e) => setEmailCategory(e.target.value)}>{EMAIL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>}</div>
      {isWhatsApp ? <><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Language</label><select className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en_US">English (US) — en_US</option><option value="hi">Hindi — hi</option><option value="hi_IN">Hindi (India) — hi_IN</option></select></div><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Header (optional, text only)</label><input className="input-field" value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} placeholder="Agarwaal Homes — Property Update"/></div></div>
      <div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Message body</label><textarea className="input-field resize-y" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1024} placeholder={'Hi {{1}}, we have properties in {{2}}. Book a site visit?'} required/><p className="mt-1 text-[11px] text-ink-400">Use variables like {'{{1}}'}, {'{{2}}'}. Sample values below are submitted to Meta.</p></div>
      <div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Sample values (comma separated)</label><input className="input-field" value={sampleValues} onChange={(e) => setSampleValues(e.target.value)} placeholder="Mohsin, Noida"/></div><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Footer (optional)</label><input className="input-field" value={footerText} onChange={(e) => setFooterText(e.target.value)} maxLength={60} placeholder="Agarwaal Homes"/></div></div>
      <div className="rounded-lg bg-ink-50 p-3 dark:bg-ink-800/70"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">Preview</p>{headerText && <p className="mb-1 font-semibold text-ink-800 dark:text-ink-100">{headerText}</p>}<p className="whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-200">{body || 'Your template message preview will appear here.'}</p>{footerText && <p className="mt-2 text-xs text-ink-500">{footerText}</p>}</div></> : <><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Email subject</label><input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="New properties you may like" required/></div><div><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Email message</label><textarea className="input-field resize-y" value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={5000} placeholder={'Hi {{name}},\n\nWe have some new properties that may fit your needs…'} required/><p className="mt-1 text-[11px] text-ink-400">Personalize with {'{{name}}'}, {'{{email}}'} or {'{{phone}}'}.</p></div></>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4 dark:border-ink-800"><button type="button" onClick={() => { setFormOpen(false); resetForm(); }} disabled={saving} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">{saving ? <Loader2 size={16} className="animate-spin"/> : isWhatsApp ? <Send size={16}/> : <Save size={16}/>} {saving ? 'Saving…' : isWhatsApp ? 'Submit for approval' : editingId ? 'Update template' : 'Save template'}</button></div></form>
    </section>}

    {loading ? <div className="card flex items-center justify-center gap-2 py-14 text-sm text-ink-500"><Loader2 size={18} className="animate-spin"/> Loading templates…</div> : items.length === 0 ? <div className="card flex flex-col items-center justify-center py-14 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-500 dark:bg-ink-800"><FileText size={22}/></span><h2 className="font-display text-base font-bold text-ink-900 dark:text-white">No templates yet</h2><p className="mt-1 max-w-md text-sm text-ink-500 dark:text-ink-400">{isWhatsApp ? 'Create a template, wait for Meta approval, then use it in WhatsApp Bulk Messages.' : 'Create a reusable email message, then select it in the Bulk Email template dropdown.'}</p><button type="button" onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2"><Plus size={15}/> Create first template</button></div> : <div className="grid gap-3 lg:grid-cols-2">{items.map((item) => <article key={item.id || item._id} className="card !p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isWhatsApp ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}><Icon size={17}/></span><div className="min-w-0"><h3 className="break-words font-semibold text-ink-900 dark:text-white">{item.name}</h3><p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{isWhatsApp ? `${item.category || 'Template'} · ${item.language || 'Language not set'}` : `${EMAIL_CATEGORIES.find((c) => c.value === item.category)?.label || 'General'} · Updated ${new Date(item.updatedAt || item.createdAt).toLocaleDateString('en-IN')}`}</p></div></div>{isWhatsApp ? <StatusBadge status={item.status}/> : <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Saved</span>}</div>
      <div className="mt-3 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/70">{!isWhatsApp && <p className="mb-1 text-xs font-semibold text-ink-700 dark:text-ink-100">Subject: {item.subject}</p>}<p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-600 dark:text-ink-300">{isWhatsApp ? ((item.components || []).map((c) => c.text).filter(Boolean).join('\n\n') || 'Template content is available from Meta.') : item.body}</p></div>
      {!isWhatsApp && <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => openEdit(item)} className="btn-secondary !px-3 !py-2 text-xs">Edit</button><button type="button" onClick={() => deleteEmail(item)} disabled={deletingId === item._id} className="btn-secondary !px-3 !py-2 text-xs text-red-600 dark:text-red-300">{deletingId === item._id ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>} Delete</button><button type="button" onClick={() => navigate('/outreach/email')} className="btn-primary !px-3 !py-2 text-xs inline-flex items-center gap-1.5">Use in bulk <ArrowRight size={13}/></button></div>}</article>)}</div>}
    {isWhatsApp && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 px-4 py-3 dark:border-ink-800"><p className="text-xs text-ink-500 dark:text-ink-400">Only approved templates can be sent. Meta controls approval, not this dashboard.</p><button type="button" onClick={() => navigate('/outreach/whatsapp')} className="btn-primary inline-flex items-center gap-2">Open WhatsApp bulk <ArrowRight size={15}/></button></div>}
  </div>;
}
