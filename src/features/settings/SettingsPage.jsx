import { useEffect, useState, useCallback } from 'react';
import {
  Bot,
  Timer,
  UserCog,
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
  PowerOff,
  Power,
  Mail,
  AlertTriangle,
} from 'lucide-react';

import { settingsApi } from '../../api/settingsApi.js';
import { whatsappApi } from '../../api/whatsappApi.js';
import { emailApi } from '../../api/emailApi.js';

/** Small reusable ON/OFF switch — no design-system toggle exists yet in this app. */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'bg-brand-600' : 'bg-ink-200 dark:bg-ink-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

const DELAY_OPTIONS = [2, 5, 10];

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(true);
  const [waBusy, setWaBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailStatusLoading, setEmailStatusLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await settingsApi.get();
      setSettings(res.data.settings);
    } catch (err) {
      setError(err?.response?.data?.message || 'Settings load nahi ho paayi');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmailStatus = useCallback(async () => {
    setEmailStatusLoading(true);
    try {
      const res = await emailApi.status();
      setEmailStatus(res.data);
    } catch {
      setEmailStatus(null);
    } finally {
      setEmailStatusLoading(false);
    }
  }, []);

  const fetchWaStatus = useCallback(async () => {
    setWaLoading(true);
    try {
      const res = await whatsappApi.status();
      setWaStatus(res.data);
    } catch {
      setWaStatus(null);
    } finally {
      setWaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchWaStatus();
    fetchEmailStatus();
  }, [fetchSettings, fetchWaStatus, fetchEmailStatus]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const patchSettings = async (updates) => {
    setSaving(true);
    setError('');
    // Optimistic update so toggles feel instant.
    setSettings((prev) => ({ ...prev, ...updates }));
    try {
      const res = await settingsApi.update(updates);
      setSettings(res.data.settings);
      showToast('Saved');
    } catch (err) {
      setError(err?.response?.data?.message || 'Update fail ho gaya');
      fetchSettings(); // roll back to server truth
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('WhatsApp disconnect karein? AI aur manual dono replies rukk jaayenge jab tak reconnect nahi karte.')) return;
    setWaBusy(true);
    try {
      await whatsappApi.disconnect();
      await fetchWaStatus();
      showToast('WhatsApp disconnected');
    } catch (err) {
      alert(err?.response?.data?.message || 'Disconnect fail ho gaya');
    } finally {
      setWaBusy(false);
    }
  };

  const handleReconnect = async () => {
    setWaBusy(true);
    try {
      await whatsappApi.reconnect();
      await fetchWaStatus();
      showToast('WhatsApp reconnected');
    } catch (err) {
      alert(err?.response?.data?.message || 'Reconnect fail ho gaya');
    } finally {
      setWaBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-ink-400" size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            AI automation aur official Meta WhatsApp Cloud API yahan se control karein.
          </p>
        </div>
        {toast && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
            {toast}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* AI Auto Reply */}
      <div className="card mt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
              <Bot size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-900 dark:text-white">AI Auto Reply</h2>
              <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                Jab ON ho, AI naye WhatsApp messages ka jawab khud-ba-khud deta hai.
              </p>
            </div>
          </div>
          <Toggle
            checked={!!settings?.autoReplyEnabled}
            disabled={saving}
            onChange={(val) => patchSettings({ autoReplyEnabled: val })}
          />
        </div>
      </div>

      {/* AI Reply Delay */}
      <div className="card mt-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
            <Timer size={20} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">AI Reply Delay</h2>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              Reply bhejne se pehle AI kitni der rukega — zyada natural feel ke liye.
            </p>
            <div className="mt-3 flex gap-2">
              {DELAY_OPTIONS.map((secs) => (
                <button
                  key={secs}
                  disabled={saving}
                  onClick={() => patchSettings({ aiReplyDelaySeconds: secs })}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    settings?.aiReplyDelaySeconds === secs
                      ? 'bg-brand-600 text-white'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'
                  }`}
                >
                  {secs}s
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Human Takeover */}
      <div className="card mt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
              <UserCog size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-900 dark:text-white">Human Takeover</h2>
              <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                ON karne par AI turant pura pause ho jaata hai — saari conversations aap khud manually
                handle karenge, jab tak wapas OFF na karein.
              </p>
            </div>
          </div>
          <Toggle
            checked={!!settings?.aiPaused}
            disabled={saving}
            onChange={(val) => patchSettings({ aiPaused: val })}
          />
        </div>
        {settings?.aiPaused && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            AI abhi paused hai — koi bhi lead ko auto-reply nahi jaa raha.
          </p>
        )}
      </div>

      {/* Resend / email sending settings */}
      <div className="card mt-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
            <Mail size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-ink-900 dark:text-white">Bulk Email & Reply Tracking</h2>
              {emailStatusLoading ? <span className="text-xs text-ink-400">Checking…</span> : (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${emailStatus?.configured ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                  {emailStatus?.configured ? 'Resend sending configured' : 'Setup required'}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Bulk emails Gmail/SMTP se nahi, Resend HTTP API se bheje jaate hain. Credentials sirf backend environment variables mein rakhein.</p>
            {emailStatusLoading ? <div className="mt-3 flex items-center gap-2 text-sm text-ink-400"><Loader2 size={16} className="animate-spin" /> Checking email provider…</div> : (
              <>
                <div className="mt-4 space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-ink-500 dark:text-ink-400">From address</span><span className="break-all text-sm font-semibold text-ink-800 dark:text-ink-100">{emailStatus?.fromAddress || 'RESEND_FROM not configured'}</span></div>
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-ink-500 dark:text-ink-400">Inbound customer replies</span><span className={`text-sm font-semibold ${emailStatus?.inboundRepliesConfigured ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-300'}`}>{emailStatus?.inboundRepliesConfigured ? 'Configured' : 'Needs setup'}</span></div>
                </div>
                {!emailStatus?.configured || !emailStatus?.inboundRepliesConfigured ? <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /><span>{emailStatus?.note || 'Email status API unavailable. Check backend and provider configuration.'} Read EMAIL_SETUP.md in the backend package for the DNS, webhook and environment setup.</span></div> : <p className="mt-3 text-xs text-green-700 dark:text-green-300">Sending and inbound reply tracking variables are present. Verify the sender domain, inbound MX records and webhook in Resend.</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Settings */}
      <div className="card mt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300">
            <Smartphone size={20} />
          </span>
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">WhatsApp Settings</h2>
        </div>

        {waLoading ? (
          <div className="mt-4 flex justify-center py-6">
            <Loader2 className="animate-spin text-ink-400" size={24} />
          </div>
        ) : !waStatus?.configured ? (
          <p className="mt-4 text-sm text-ink-500 dark:text-ink-400">
            Meta WhatsApp Cloud API abhi configured nahi hai. Backend par META_WHATSAPP_ACCESS_TOKEN aur META_WHATSAPP_PHONE_NUMBER_ID set karein.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between border-b border-ink-50 pb-3 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Connected Number</span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">
                {waStatus.phoneNumber ? `+${waStatus.phoneNumber}` : 'Not available'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-ink-50 pb-3 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Provider</span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">Meta WhatsApp Cloud API</span>
            </div>

            <div className="flex items-center justify-between border-b border-ink-50 pb-3 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Verified Name</span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">
                {waStatus.verifiedName || 'Not available'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-ink-50 pb-3 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Connection Status</span>
              {waStatus.disconnected ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
                  <XCircle size={16} /> Disconnected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400">
                  <CheckCircle2 size={16} /> Connected
                </span>
              )}
            </div>

            <div className="flex justify-end pt-1">
              {waStatus.disconnected ? (
                <button
                  onClick={handleReconnect}
                  disabled={waBusy}
                  className="btn-primary flex items-center gap-2"
                >
                  {waBusy ? <Loader2 className="animate-spin" size={16} /> : <Power size={16} />}
                  Reconnect
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  disabled={waBusy}
                  className="btn-secondary flex items-center gap-2 !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                >
                  {waBusy ? <Loader2 className="animate-spin" size={16} /> : <PowerOff size={16} />}
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
