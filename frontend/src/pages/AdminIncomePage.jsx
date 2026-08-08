import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import {
  adminLogin,
  clearAdminToken,
  createAdminPaymentRecord,
  fetchApplicant,
  fetchAdminPaymentPreview,
  fetchAdminPaymentRecords,
  fetchApplicants,
  getAdminToken,
} from '../lib/api.js';

const loginInitial = { username: '', password: '' };
const searchInitial = { pickerId: '' };

const formatDate = value => new Intl.DateTimeFormat('en-GB', {
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

const toUtcDayKey = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
};

export default function AdminIncomePage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [loginForm, setLoginForm] = useState(loginInitial);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [searchForm, setSearchForm] = useState(searchInitial);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState('');
  const [paymentForm, setPaymentForm] = useState({ fromDate: '', toDate: '', paidAmount: '', notes: '' });
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  const totalIncome = useMemo(() => Number(selectedApplicant?.totalIncome || 0), [selectedApplicant]);
  const incomeRecords = selectedApplicant?.incomeRecords || [];
  const expenseRecords = selectedApplicant?.expenseRecords || [];
  const fineRecords = selectedApplicant?.fineRecords || [];
  const totalFine = useMemo(() => Number(selectedApplicant?.totalFine || 0), [selectedApplicant]);
  const expenseTotalDisplay = useMemo(() => Number(selectedApplicant?.totalExpense || 0), [selectedApplicant]);
  const rangeIncomeTotal = useMemo(() => {
    if (!paymentForm.fromDate || !paymentForm.toDate || !incomeRecords.length) {
      return 0;
    }

    const fromKey = paymentForm.fromDate;
    const toKey = paymentForm.toDate;

    return incomeRecords.reduce((sum, record) => {
      const recordKey = toUtcDayKey(record.date);
      if (!recordKey || recordKey < fromKey || recordKey > toKey) {
        return sum;
      }

      const value = Number(record.calculatedIncome || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }, [incomeRecords, paymentForm.fromDate, paymentForm.toDate]);

  const paymentTotal = useMemo(() => Number((paymentPreview?.netPayable ?? (rangeIncomeTotal ?? totalIncome) - (paymentPreview?.expenseTotal ?? expenseTotalDisplay) - (paymentPreview?.fineTotal ?? totalFine)) || 0), [paymentPreview, rangeIncomeTotal, totalIncome, expenseTotalDisplay, totalFine]);
  const paymentPreviewReady = Boolean(paymentPreview);

  const hasPaymentRange = Boolean(paymentForm.fromDate && paymentForm.toDate);

  useEffect(() => {
    if (!isAuthenticated) {
      setApplicants([]);
      setSelectedApplicant(null);
      setSearchQuery('');
      setSearchForm(searchInitial);
    }
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
    setApplicants([]);
    setSelectedApplicant(null);
    setSelectedError('');
    setSearchError('');
  };

  const loadIncomeApplicants = async pickerId => {
    const nextPickerId = String(pickerId || '').trim();
    setSearchQuery(nextPickerId);
    setSearchLoading(true);
    setSearchError('');
    setSelectedError('');

    try {
      const response = await fetchApplicants({ pickerId: nextPickerId, limit: 50, page: 1, sortField: 'createdAt', sortDirection: 'desc' });
      const nextApplicants = response.data.applicants || [];
      setApplicants(nextApplicants);
      if (nextApplicants.length === 1) {
        await openApplicant(nextApplicants[0]);
      } else {
        setSelectedApplicant(null);
      }
    } catch (error) {
      setApplicants([]);
      setSearchError(error.message || 'Failed to search picker ID');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = async event => {
    event.preventDefault();
    if (!searchForm.pickerId.trim()) {
      setSearchError('Enter a picker ID to search');
      return;
    }

    await loadIncomeApplicants(searchForm.pickerId);
  };

  const clearSearch = () => {
    setSearchForm(searchInitial);
    setSearchQuery('');
    setApplicants([]);
    setSelectedApplicant(null);
    setSearchError('');
    setSelectedError('');
  };

  const openApplicant = async applicant => {
    setSelectedLoading(true);
    setSelectedError('');

    try {
      const response = await fetchApplicant(applicant._id);
      setSelectedApplicant(response.data.applicant);
    } catch (error) {
      setSelectedError(error.message || 'Failed to load income detail');
    } finally {
      setSelectedLoading(false);
    }
  };

  const loadPaymentHistory = async applicantId => {
    try {
      const response = await fetchAdminPaymentRecords({ applicantId });
      setPaymentHistory(response.data.paymentRecords || []);
    } catch {
      setPaymentHistory([]);
    }
  };

  const loadPaymentPreview = async () => {
    if (!selectedApplicant?._id) {
      setPaymentError('Select an applicant first');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');
    setPaymentSuccess('');

    try {
      const response = await fetchAdminPaymentPreview({
        applicantId: selectedApplicant._id,
        fromDate: paymentForm.fromDate,
        toDate: paymentForm.toDate,
      });

      setPaymentPreview(response.data);
    } catch (error) {
      setPaymentPreview(null);
      setPaymentError(error.message || 'Failed to load payment preview');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleMarkAsPaid = async event => {
    event.preventDefault();

    if (!selectedApplicant?._id) {
      setPaymentError('Select an applicant first');
      return;
    }

    setPaymentSaving(true);
    setPaymentError('');
    setPaymentSuccess('');

    try {
      const response = await createAdminPaymentRecord({
        applicantId: selectedApplicant._id,
        fromDate: paymentForm.fromDate,
        toDate: paymentForm.toDate,
        paidAmount: paymentForm.paidAmount,
        notes: paymentForm.notes,
      });

      setPaymentSuccess('Payment marked as paid and email sent');
      setPaymentPreview(response.data?.summary || null);
      await loadPaymentHistory(selectedApplicant._id);
    } catch (error) {
      setPaymentError(error.message || 'Failed to mark payment as paid');
    } finally {
      setPaymentSaving(false);
    }
  };

  useEffect(() => {
    if (selectedApplicant?._id) {
      setPaymentPreview(null);
      setPaymentError('');
      setPaymentSuccess('');
      loadPaymentHistory(selectedApplicant._id);
    } else {
      setPaymentHistory([]);
      setPaymentPreview(null);
    }
  }, [selectedApplicant?._id]);

  useEffect(() => {
    if (!selectedApplicant?._id || !hasPaymentRange) {
      return;
    }

    loadPaymentPreview();
  }, [selectedApplicant?._id, paymentForm.fromDate, paymentForm.toDate]);

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <h1 className="text-xl font-semibold text-slate-900">Income management</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to search a picker ID and review income history before payout.</p>
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
            <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700">Income manager</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Income details by picker ID</h1>
          <p className="mt-1 text-sm text-slate-600">Search a picker ID, open the person’s record, and review the full payout history in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Logout
          </button>
          <Link
            to="/admin"
            className="rounded-full border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50"
          >
            Applicant admin
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="block flex-1 text-sm font-medium text-slate-700">
            Picker ID
            <input
              className="input mt-2"
              value={searchForm.pickerId}
              onChange={event => setSearchForm({ pickerId: event.target.value })}
              placeholder="P-0001"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={searchLoading}
              className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {searchLoading ? 'Searching…' : 'Search'}
            </button>
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
        {searchError ? <p className="mt-3 text-sm text-rose-600">{searchError}</p> : null}
        {searchQuery ? <p className="mt-3 text-xs text-slate-500">Showing results for picker ID: {searchQuery}</p> : null}
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Matching users</h2>
              <p className="text-sm text-slate-500">Click a user to see the full income table.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{applicants.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {applicants.length > 0 ? applicants.map(applicant => (
              <button
                key={applicant._id}
                type="button"
                onClick={() => openApplicant(applicant)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${selectedApplicant?._id === applicant._id ? 'border-forest-300 bg-forest-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{applicant.fullName}</p>
                    <p className="mt-1 text-sm text-slate-500">{applicant.email}</p>
                    <p className="mt-1 text-sm text-slate-600">Picker ID: {applicant.pickerId || '—'}</p>
                    <p className="mt-1 text-sm text-slate-600">Group: {applicant.groupName || '—'}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">View</span>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Search by picker ID to load matching users.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-2 border-b border-forest-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Payout detail</h2>
              <p className="text-sm text-slate-500">Bank details and tabular income history for the selected user.</p>
            </div>
            {selectedApplicant ? (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">Current total</p>
                <p className="text-lg font-semibold text-emerald-700">{formatEuro(totalIncome)}</p>
              </div>
            ) : null}
          </div>

          {selectedLoading ? <p className="mt-5 text-sm text-slate-600">Loading detail…</p> : null}
          {selectedError ? <p className="mt-5 text-sm text-rose-600">{selectedError}</p> : null}

          {selectedApplicant ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-forest-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedApplicant.fullName}</p>
                </div>
                <div className="rounded-2xl bg-forest-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Picker ID</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedApplicant.pickerId || '—'}</p>
                </div>
                <div className="rounded-2xl bg-forest-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Bank name</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedApplicant.bankName || '—'}</p>
                </div>
                <div className="rounded-2xl bg-forest-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Bank account</p>
                  <p className="mt-1 break-all font-semibold text-slate-900">{selectedApplicant.bankAccountNumber || '—'}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Location</th>
                        <th className="px-4 py-3 font-semibold">Berry type</th>
                        <th className="px-4 py-3 font-semibold">Berry wt</th>
                        <th className="px-4 py-3 font-semibold">Cart wt</th>
                        <th className="px-4 py-3 font-semibold">Price / kg</th>
                        <th className="px-4 py-3 font-semibold">Income</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {incomeRecords.length > 0 ? incomeRecords.map(record => (
                        <tr key={record._id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 text-slate-700">{record.date ? formatDate(record.date) : '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{record.location || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{record.berryType || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{formatNumber(record.berryWeightKg)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatNumber(record.carrotWeightKg)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatEuro(record.amount)}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-700">{formatEuro(record.calculatedIncome)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-4 py-8 text-center text-slate-500" colSpan="7">No income history found for this person.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Expense history</h3>
                    <p className="text-sm text-slate-500">Recurring expense records for the selected picker.</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-2 text-right shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total expense</p>
                    <p className="text-lg font-semibold text-rose-700">{formatEuro(expenseTotalDisplay)}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Plan</th>
                        <th className="px-4 py-3 font-semibold">Group</th>
                        <th className="px-4 py-3 font-semibold">Daily rate</th>
                        <th className="px-4 py-3 font-semibold">Expense</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {expenseRecords.length > 0 ? expenseRecords.map(record => (
                        <tr key={record._id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 text-slate-700">{record.date ? formatDate(record.date) : '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{record.expenseType === 'own-car' ? 'Own car' : 'Rented car'}</td>
                          <td className="px-4 py-3 text-slate-700">{record.groupName || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{formatEuro(record.dailyAmount)}</td>
                          <td className="px-4 py-3 font-semibold text-rose-700">{formatEuro(record.calculatedExpense)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-4 py-8 text-center text-slate-500" colSpan="5">No expense history found for this person.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Fine history</h3>
                    <p className="text-sm text-slate-500">Fines deducted separately from the payout settlement.</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-2 text-right shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total fine</p>
                    <p className="text-lg font-semibold text-rose-700">{formatEuro(fineRecords.reduce((sum, record) => sum + Number(record.netAmount || 0), 0))}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Reason</th>
                        <th className="px-4 py-3 font-semibold">Amount</th>
                        <th className="px-4 py-3 font-semibold">VAT</th>
                        <th className="px-4 py-3 font-semibold">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {fineRecords.length > 0 ? fineRecords.map(record => (
                        <tr key={record._id}>
                          <td className="px-4 py-3 text-slate-700">{record.date ? formatDateOnlyUtc(record.date) : '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{record.reason || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{formatEuro(record.amount)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatEuro(record.vatAmount)}</td>
                          <td className="px-4 py-3 font-semibold text-rose-700">{formatEuro(record.netAmount)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan="5">No fine records found for this picker.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <form className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleMarkAsPaid}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Payout settlement</h3>
                    <p className="text-sm text-slate-600">Choose a date range, preview the settlement, then mark it as paid.</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Preview net payable</p>
                    <p className="text-lg font-semibold text-forest-700">{paymentPreviewReady ? formatEuro(paymentTotal) : '—'}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    From date
                    <input
                      className="input mt-2"
                      type="date"
                      value={paymentForm.fromDate}
                      onChange={event => setPaymentForm(current => ({ ...current, fromDate: event.target.value }))}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    To date
                    <input
                      className="input mt-2"
                      type="date"
                      value={paymentForm.toDate}
                      onChange={event => setPaymentForm(current => ({ ...current, toDate: event.target.value }))}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Paid amount
                    <input
                      className="input mt-2"
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentForm.paidAmount}
                      onChange={event => setPaymentForm(current => ({ ...current, paidAmount: event.target.value }))}
                      placeholder="Leave empty to use net payable"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Note
                    <input
                      className="input mt-2"
                      value={paymentForm.notes}
                      onChange={event => setPaymentForm(current => ({ ...current, notes: event.target.value }))}
                      placeholder="Optional payment note"
                    />
                  </label>
                </div>

                <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Income total</p>
                    <p className="mt-1 font-semibold text-slate-900">{paymentPreviewReady ? formatEuro(paymentPreview?.incomeTotal ?? 0) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Expense total</p>
                    <p className="mt-1 font-semibold text-slate-900">{paymentPreviewReady ? formatEuro(paymentPreview?.expenseTotal ?? 0) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Fine total</p>
                    <p className="mt-1 font-semibold text-slate-900">{paymentPreviewReady ? formatEuro(paymentPreview?.fineTotal ?? 0) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Net payable</p>
                    <p className="mt-1 font-semibold text-forest-700">{paymentPreviewReady ? formatEuro(paymentPreview?.netPayable ?? 0) : '—'}</p>
                  </div>
                </div>

                {paymentError ? <p className="text-sm text-rose-600">{paymentError}</p> : null}
                {paymentSuccess ? <p className="text-sm text-emerald-600">{paymentSuccess}</p> : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadPaymentPreview}
                    disabled={paymentLoading}
                    className="rounded-full border border-forest-200 bg-white px-4 py-2.5 text-sm font-semibold text-forest-700 transition hover:bg-forest-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paymentLoading ? 'Previewing…' : 'Preview settlement'}
                  </button>
                  <button
                    type="submit"
                    disabled={paymentSaving}
                    className="rounded-full bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paymentSaving ? 'Saving…' : 'Mark as paid'}
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Payment history</h3>
                    <p className="text-sm text-slate-500">All payout settlements recorded for this user.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{paymentHistory.length}</span>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Period</th>
                        <th className="px-4 py-3 font-semibold">Income</th>
                        <th className="px-4 py-3 font-semibold">Expense</th>
                        <th className="px-4 py-3 font-semibold">Fine</th>
                        <th className="px-4 py-3 font-semibold">Net payable</th>
                        <th className="px-4 py-3 font-semibold">Paid amount</th>
                        <th className="px-4 py-3 font-semibold">Paid at</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paymentHistory.length > 0 ? paymentHistory.map(record => (
                        <tr key={record._id}>
                          <td className="px-4 py-3 text-slate-700">
                            {record.fromDate ? formatDateOnlyUtc(record.fromDate) : '—'} → {record.toDate ? formatDateOnlyUtc(record.toDate) : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{formatEuro(record.incomeTotal)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatEuro(record.expenseTotal)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatEuro(record.fineTotal || 0)}</td>
                          <td className="px-4 py-3 font-semibold text-forest-700">{formatEuro(record.netPayable)}</td>
                          <td className="px-4 py-3 font-semibold text-forest-700">{formatEuro(record.paidAmount)}</td>
                          <td className="px-4 py-3 text-slate-700">{record.paidAt ? formatDate(record.paidAt) : '—'}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan="7">No payment history yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Select a user from the left panel to inspect bank details and income records.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
