import { useEffect, useState, useCallback } from 'react';
import { UserCircle, Building2, Mail, Phone, KeyRound, Loader2, Save } from 'lucide-react';

import { authApi } from '../../api/authApi.js';
import { settingsApi } from '../../api/settingsApi.js';
import { useAuthStore } from '../../store/authStore.js';

export default function ProfilePage() {
  const { user, setSession, accessToken } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, settingsRes] = await Promise.all([authApi.me(), settingsApi.get()]);
      setEmail(meRes.data.user.email || '');
      setPhone(meRes.data.user.phone || '');
      setCompanyName(settingsRes.data.settings.companyName || '');
    } catch (err) {
      setError(err?.response?.data?.message || 'Profile load nahi ho paayi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const [profileRes] = await Promise.all([
        authApi.updateProfile({ email, phone }),
        settingsApi.update({ companyName }),
      ]);
      setSession(profileRes.data.user, accessToken);
      setSuccess('Profile updated');
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError(err?.response?.data?.message || 'Update fail ho gaya');
    } finally {
      setSaving(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return;
    setResetSending(true);
    setError('');
    try {
      await authApi.forgotPassword({ email });
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Reset link bhejne mein dikkat hui');
    } finally {
      setResetSending(false);
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
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
          {user?.name?.[0]?.toUpperCase() || <UserCircle size={22} />}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Profile</h1>
          {/* <p className="mt-0.5 text-sm capitalize text-ink-500 dark:text-ink-400">{user?.role}</p> */}
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="card mt-6 space-y-5">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-700 dark:text-ink-300">
            <Building2 size={15} /> Company Name
          </label>
          <input
            className="input-field"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your company / agency name"
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-700 dark:text-ink-300">
            <Mail size={15} /> Email
          </label>
          <input
            type="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-700 dark:text-ink-300">
            <Phone size={15} /> Phone
          </label>
          <input
            className="input-field"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="card mt-4">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink-900 dark:text-white">
          <KeyRound size={17} /> Password
        </h2>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Password badalne ke liye ek reset link aapke email par bhej denge.
        </p>
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={resetSending || !email}
          className="btn-secondary mt-3 flex items-center gap-2"
        >
          {resetSending ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
          {resetSending ? 'Sending…' : 'Forgot Password'}
        </button>
        {resetSent && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            Reset link {email} par bhej diya gaya hai (agar account exist karta hai).
          </p>
        )}
      </div>
    </div>
  );
}
