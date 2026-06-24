import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestUserPasswordReset } from '../lib/api.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await requestUserPasswordReset(email);
      setSuccess('If an account exists for that email, a reset link has been sent.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to request reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Password help</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Forgot your password?</h1>
        <p className="mt-2 text-sm text-slate-600">Enter your email and we will send a secure reset link.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="input mt-2"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/portal" className="font-semibold text-forest-700 hover:text-forest-800">
            Back to login
          </Link>
        </div>
      </div>
    </section>
  );
}