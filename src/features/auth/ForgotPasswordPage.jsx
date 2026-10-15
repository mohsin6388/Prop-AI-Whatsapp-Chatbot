import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Check your email</h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a link to reset
          your password.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Reset your password</h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
        Back to log in
      </Link>
    </div>
  );
}
