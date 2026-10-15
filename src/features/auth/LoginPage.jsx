import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login({ email: form.email.trim().toLowerCase(), password: form.password });
      setSession(data.user, data.accessToken);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Login nahi ho paya. Email aur password check karke dobara try karein.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
        <LockKeyhole size={22} />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">AGARWAAL HOMES</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900 dark:text-white">Welcome back</h1>
      <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">Sign in to manage your property leads, campaigns and buyer conversations.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">{error}</div>}
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ink-700 dark:text-ink-300">Work email</label>
          <div className="relative">
            <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input id="email" name="email" type="email" autoComplete="username" required className="input-field !rounded-xl !py-3 !pl-10" placeholder="you@agarwaalhomes.com" value={form.email} onChange={(e) => setForm((state) => ({ ...state, email: e.target.value }))} />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-semibold text-ink-700 dark:text-ink-300">Password</label>
            <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Forgot password?</Link>
          </div>
          <div className="relative">
            <LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required minLength={8} className="input-field !rounded-xl !py-3 !pl-10 !pr-12" placeholder="Enter your password" value={form.password} onChange={(e) => setForm((state) => ({ ...state, password: e.target.value }))} />
            <button type="button" onClick={() => setShowPassword((show) => !show)} className="absolute inset-y-0 right-0 flex items-center px-3.5 text-ink-400 hover:text-ink-700 dark:hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 !rounded-xl !py-3 disabled:cursor-not-allowed disabled:opacity-70">
          {loading ? <Loader2 size={17} className="animate-spin" /> : null}
          {loading ? 'Signing in…' : 'Sign in'}
          {!loading && <ArrowRight size={17} />}
        </button>
      </form>

      <div className="mt-7 flex items-start gap-2 rounded-xl bg-ink-50 p-3.5 text-xs leading-5 text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
        <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-green-600" />
        <span>Secure access for your team. Account creation is managed by your administrator.</span>
      </div>
    </div>
  );
}
