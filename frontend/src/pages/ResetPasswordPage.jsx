import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { resetUserPassword } from '../lib/api.js';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Reset token is missing or invalid');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await resetUserPassword(token, passwordForm.newPassword);
      setSuccess('Password updated successfully. Redirecting to login…');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => navigate('/portal'), 1200);
    } catch (resetError) {
      setError(resetError.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Secure reset</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Create a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Choose a password you have not used before.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <PasswordField
            label="New password"
            value={passwordForm.newPassword}
            onChange={event => setPasswordForm(current => ({ ...current, newPassword: event.target.value }))}
            autoComplete="new-password"
            required
          />
          <PasswordField
            label="Confirm new password"
            value={passwordForm.confirmPassword}
            onChange={event => setPasswordForm(current => ({ ...current, confirmPassword: event.target.value }))}
            autoComplete="new-password"
            required
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/portal/forgot-password" className="font-semibold text-forest-700 hover:text-forest-800">
            Request a new link
          </Link>
          <Link to="/portal" className="font-semibold text-slate-600 hover:text-forest-700">
            Login
          </Link>
        </div>
      </div>
    </section>
  );
}