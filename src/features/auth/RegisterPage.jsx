import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.register(form);
      setSession(data.user, data.accessToken);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details?.[0]?.message || err.response?.data?.message || 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">
        Create your organization
      </h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
        You&apos;ll be set up as the Admin. Invite Builders and Brokers afterwards.
      </p>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
            Full name
          </label>
          <input id="name" name="name" required className="input-field" value={form.name} onChange={handleChange} />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input-field"
            value={form.email}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
            Phone (optional)
          </label>
          <input id="phone" name="phone" className="input-field" value={form.phone} onChange={handleChange} />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="input-field"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={handleChange}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </div>
  );
}
