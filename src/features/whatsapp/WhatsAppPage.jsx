import { useEffect, useMemo, useState } from 'react';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  Webhook,
  Copy,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

import { whatsappApi } from '../../api/whatsappApi.js';
import api from '../../api/axios.js';

function getWebhookUrl() {
  const base = api.defaults.baseURL || window.location.origin;
  return `${base.replace(/\/api\/?$/, '')}/api/whatsapp/webhook`;
}

export default function WhatsAppPage() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [error, setError] = useState(null);

  const [testPhone, setTestPhone] = useState('');
  const [testText, setTestText] = useState('');
  const [templatePhone, setTemplatePhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = useMemo(() => getWebhookUrl(), []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await whatsappApi.status();
      setStatusData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load WhatsApp status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSendTest = async (e) => {
    e.preventDefault();
    setSending(true);

    try {
      await whatsappApi.sendTest(testPhone, testText);
      alert('WhatsApp message sent successfully.');
      setTestText('');
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async (e) => {
    e.preventDefault();
    setSendingTemplate(true);

    try {
      await whatsappApi.sendTestTemplate(templatePhone);
      alert('Opening template sent successfully.');
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to send template');
    } finally {
      setSendingTemplate(false);
    }
  };

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const configured = statusData?.configured;
  const disconnected = statusData?.disconnected;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">WhatsApp</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Official WhatsApp Business Platform via Meta Cloud API. No QR scan is required.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="btn-secondary flex w-fit items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card mt-6 flex justify-center py-16">
          <Loader2 className="animate-spin text-ink-400" size={32} />
        </div>
      ) : (
        <>
          <div className="card mt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300">
                  <Smartphone size={22} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Meta WhatsApp Cloud API</h2>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                    The connected WhatsApp Business number is managed on the backend using Meta credentials.
                  </p>
                </div>
              </div>

              {configured ? (
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  disconnected
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                }`}>
                  {disconnected ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                  {disconnected ? 'Paused' : 'Configured'}
                </span>
              ) : (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <XCircle size={14} /> Not configured
                </span>
              )}
            </div>

            {!configured ? (
              <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                Configure <strong>META_WHATSAPP_ACCESS_TOKEN</strong> and <strong>META_WHATSAPP_PHONE_NUMBER_ID</strong> on the backend, then refresh this page.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Info label="Phone Number" value={statusData.phoneNumber ? `+${statusData.phoneNumber}` : 'Not available'} />
                <Info label="Verified Name" value={statusData.verifiedName || 'Not available'} />
                <Info label="Live Status" value={statusData.liveStatus || 'Not available'} />
                <Info label="Quality Rating" value={statusData.qualityRating || 'Not available'} />
                <Info label="WABA ID" value={statusData.businessAccountId || 'Not available'} />
                <Info label="Phone Number ID" value={statusData.phoneNumberId || 'Not available'} />
                <Info label="API Version" value={statusData.apiVersion || 'Not available'} />
                <Info
                  label="Opening Template"
                  value={statusData.openingTemplateConfigured ? 'Configured' : 'Not configured'}
                />
              </div>
            )}
          </div>

          {configured && (
            <>
              <div className="card mt-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900 dark:text-white">
                  <ShieldCheck size={19} />
                  Opening template
                </h2>
                <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
                  Meta requires an approved template when the business starts a new conversation with a lead who has not messaged the number in the last 24 hours.
                </p>

                <form onSubmit={handleSendTemplate} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={templatePhone}
                    onChange={(e) => setTemplatePhone(e.target.value)}
                    placeholder="919XXXXXXXXX"
                    className="flex-1"
                    required
                  />
                  <button disabled={sendingTemplate} className="btn-primary flex items-center justify-center gap-2">
                    {sendingTemplate ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    {sendingTemplate ? 'Sending...' : 'Send opening template'}
                  </button>
                </form>
              </div>

              <div className="card mt-6">
                <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Send test message</h2>
                <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
                  Free-text messages are allowed after the customer has messaged the WhatsApp number and the 24-hour customer service window is open.
                </p>

                <form onSubmit={handleSendTest} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
                  <input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="919XXXXXXXXX"
                    required
                  />
                  <input
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Message"
                    required
                  />
                  <button disabled={sending} className="btn-primary flex items-center justify-center gap-2">
                    {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    Send
                  </button>
                </form>
              </div>

              <div className="card mt-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900 dark:text-white">
                  <Webhook size={19} />
                  Meta webhook
                </h2>
                <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
                  Register this endpoint in Meta Developer Dashboard → WhatsApp → Configuration → Webhooks and subscribe to the <strong>messages</strong> field.
                </p>
                <div className="mt-3 flex gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-ink-50 px-3 py-2 text-xs dark:bg-ink-800 dark:text-ink-200">
                    {webhookUrl}
                  </code>
                  <button onClick={copyWebhook} className="btn-secondary flex items-center gap-2" title="Copy webhook URL">
                    <Copy size={15} />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-3 text-xs text-ink-400">
                  The verify token is configured on the backend and must match the token entered in Meta when saving the webhook.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
      <p className="text-xs font-medium text-ink-400">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-ink-900 dark:text-white">{value}</p>
    </div>
  );
}
