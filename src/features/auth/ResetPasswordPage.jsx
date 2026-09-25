import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Invalid link</h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          This password reset link is missing its token. Please request a new one.
        </p>
        <Link to="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-brand-600">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Set a new password</h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">Choose a strong password for your account.</p>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            Password reset! Redirecting to log in…
          </div>
        )}
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
