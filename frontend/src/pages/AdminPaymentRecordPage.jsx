import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { adminLogin, clearAdminToken, fetchAdminPaymentRecords, getAdminToken } from '../lib/api.js';

const loginInitial = { username: '', password: '' };

const formatDateTime = value => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Helsinki',
}).format(new Date(value));

const formatDateOnlyUtc = value => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'UTC',
}).format(new Date(value));

const formatNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value || '0');
};

const formatEuro = value => `€${formatNumber(value)}`;

const getApplicant = record => {
  const applicant = record?.applicantId;
  if (!applicant || typeof applicant !== 'object') {
    return {
      fullName: '—',
      email: '—',
      pickerId: record?.pickerId || '—',
      groupName: '—',
    };
  }

  return {
    fullName: applicant.fullName || '—',
    email: applicant.email || '—',
    pickerId: applicant.pickerId || record?.pickerId || '—',
    groupName: applicant.groupName || '—',
  };
};

export default function AdminPaymentRecordPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [loginForm, setLoginForm] = useState(loginInitial);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [summary, setSummary] = useState({ count: 0, paidAmount: 0, incomeTotal: 0, expenseTotal: 0, fineTotal: 0, netPayable: 0 });

  useEffect(() => {
    if (!isAuthenticated) {
      setPaymentRecords([]);
      setSummary({ count: 0, paidAmount: 0, incomeTotal: 0, expenseTotal: 0, fineTotal: 0, netPayable: 0 });
      setSearch('');
    }
  }, [isAuthenticated]);

  const loadPayments = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchAdminPaymentRecords();
      setPaymentRecords(response.data.paymentRecords || []);
      setSummary(response.data.summary || { count: 0, paidAmount: 0, incomeTotal: 0, expenseTotal: 0, fineTotal: 0, netPayable: 0 });
    } catch (loadError) {
      setPaymentRecords([]);
      setSummary({ count: 0, paidAmount: 0, incomeTotal: 0, expenseTotal: 0, fineTotal: 0, netPayable: 0 });
      setError(loadError.message || 'Failed to load payment records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleLoginSubmit = async event => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      await adminLogin(loginForm);
      setIsAuthenticated(true);
      setLoginForm(loginInitial);
    } catch (error) {
      setLoginError(error.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    setPaymentRecords([]);
    setError('');
  };

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return paymentRecords;
    }

    return paymentRecords.filter(record => {
      const applicant = getApplicant(record);
      const fields = [
        applicant.fullName,
        applicant.email,
        applicant.pickerId,
        applicant.groupName,
        record.paidBy,
        record.notes,
        record.status,
        record.currency,
        record.fromDate,
        record.toDate,
      ].join(' ').toLowerCase();

      return fields.includes(query);
    });
  }, [paymentRecords, search]);

  const totals = useMemo(() => filteredRecords.reduce((accumulator, record) => {
    const paidAmount = Number(record.paidAmount || 0);
    const incomeTotal = Number(record.incomeTotal || 0);
    const expenseTotal = Number(record.expenseTotal || 0);
    const fineTotal = Number(record.fineTotal || 0);
    const netPayable = Number(record.netPayable || 0);

    accumulator.count += 1;
    accumulator.paidAmount += Number.isFinite(paidAmount) ? paidAmount : 0;
    accumulator.incomeTotal += Number.isFinite(incomeTotal) ? incomeTotal : 0;
    accumulator.expenseTotal += Number.isFinite(expenseTotal) ? expenseTotal : 0;
    accumulator.fineTotal += Number.isFinite(fineTotal) ? fineTotal : 0;
    accumulator.netPayable += Number.isFinite(netPayable) ? netPayable : 0;
    return accumulator;
  }, { count: 0, paidAmount: 0, incomeTotal: 0, expenseTotal: 0, fineTotal: 0, netPayable: 0 }), [filteredRecords]);

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <h1 className="text-xl font-semibold text-slate-900">Payment records</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to review all payment history in one place.</p>
          <form className="mt-6 space-y-4 text-left" onSubmit={handleLoginSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Username
              <input
                className="input mt-2"
                value={loginForm.username}
                onChange={event => setLoginForm(current => ({ ...current, username: event.target.value }))}
                autoComplete="username"
                required
              />
            </label>
            <PasswordField
              label="Password"
              value={loginForm.password}
              onChange={event => setLoginForm(current => ({ ...current, password: event.target.value }))}
              autoComplete="current-password"
              required
              labelClassName="block text-sm font-medium text-slate-700"
            />
            {loginError ? <p className="text-sm text-rose-600">{loginError}</p> : null}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-forest-100 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to admin
            </button>
            <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700">Payment record</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">All payment history</h1>
          <p className="mt-1 text-sm text-slate-600">View every payout with its applicant, period, totals, and notes in a single table.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPayments}
            className="rounded-full border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payments</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(totals.count)}</p>
          <p className="mt-1 text-sm text-slate-500">Visible after search</p>
        </div>
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Paid amount</p>
          <p className="mt-2 text-2xl font-semibold text-forest-700">{formatEuro(totals.paidAmount)}</p>
          <p className="mt-1 text-sm text-slate-500">Total cash transferred</p>
        </div>
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Income total</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatEuro(totals.incomeTotal)}</p>
          <p className="mt-1 text-sm text-slate-500">Across displayed payment rows</p>
        </div>
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Expense total</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{formatEuro(totals.expenseTotal)}</p>
          <p className="mt-1 text-sm text-slate-500">Deducted before payout</p>
        </div>
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Fine total</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{formatEuro(totals.fineTotal)}</p>
          <p className="mt-1 text-sm text-slate-500">Deducted separately from expense</p>
        </div>
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Net payable</p>
          <p className="mt-2 text-2xl font-semibold text-forest-700">{formatEuro(totals.netPayable)}</p>
          <p className="mt-1 text-sm text-slate-500">Income minus expense minus fine</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 border-b border-forest-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            <p className="text-sm text-slate-500">Filter the payment list by name, picker ID, group, or note text. Showing {filteredRecords.length} of {summary.count} loaded records.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700 sm:min-w-[320px]">
            Search
            <input
              className="input mt-2"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search name, picker ID, period, notes, or paid by"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {loading ? <p className="mt-4 text-sm text-slate-600">Loading payment records…</p> : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Paid at</th>
                  <th className="px-4 py-3 font-semibold">Applicant</th>
                  <th className="px-4 py-3 font-semibold">Picker ID</th>
                  <th className="px-4 py-3 font-semibold">Group</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">Income</th>
                  <th className="px-4 py-3 font-semibold">Expense</th>
                  <th className="px-4 py-3 font-semibold">Fine</th>
                  <th className="px-4 py-3 font-semibold">Net payable</th>
                  <th className="px-4 py-3 font-semibold">Paid amount</th>
                  <th className="px-4 py-3 font-semibold">Paid by</th>
                  <th className="px-4 py-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {!loading && filteredRecords.length > 0 ? filteredRecords.map(record => {
                  const applicant = getApplicant(record);
                  return (
                    <tr key={record._id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-700">{record.paidAt ? formatDateTime(record.paidAt) : '—'}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{applicant.fullName}</p>
                          <p className="text-xs text-slate-500">{applicant.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{applicant.pickerId}</td>
                      <td className="px-4 py-3 text-slate-700">{applicant.groupName}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {record.fromDate ? formatDateOnlyUtc(record.fromDate) : '—'} → {record.toDate ? formatDateOnlyUtc(record.toDate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatEuro(record.incomeTotal)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatEuro(record.expenseTotal)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatEuro(record.fineTotal)}</td>
                      <td className="px-4 py-3 font-semibold text-forest-700">{formatEuro(record.netPayable)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatEuro(record.paidAmount)}</td>
                      <td className="px-4 py-3 text-slate-700">{record.paidBy || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{record.notes || '—'}</td>
                    </tr>
                  );
                }) : null}
                {!loading && filteredRecords.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan="12">
                      No payment records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
