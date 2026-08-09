import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import PasswordField from '../components/PasswordField.jsx';
import { adminLogin, clearAdminToken, createAdminPaymentRecord, fetchAdminPaymentPreview, fetchAdminPaymentRecords, fetchApplicant, getAdminToken } from '../lib/api.js';

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

const formatSettlementAmount = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
};

const emptySettlementForm = { fromDate: '', toDate: '', paidAmount: '', notes: '' };

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

const buildPaymentExportRows = records => records.map(record => {
  const applicant = getApplicant(record);

  return {
    'Paid at': record.paidAt ? formatDateTime(record.paidAt) : '—',
    Applicant: applicant.fullName,
    Email: applicant.email,
    'Picker ID': applicant.pickerId,
    Group: applicant.groupName,
    Period: `${record.fromDate ? formatDateOnlyUtc(record.fromDate) : '—'} → ${record.toDate ? formatDateOnlyUtc(record.toDate) : '—'}`,
    Income: formatEuro(record.incomeTotal),
    Expense: formatEuro(record.expenseTotal),
    Fine: formatEuro(record.fineTotal),
    'Net payable': formatEuro(record.netPayable),
    'Paid amount': formatEuro(record.paidAmount),
    'Paid by': record.paidBy || '—',
    Notes: record.notes || '—',
    Status: record.status || '—',
  };
});

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
  const [selectedPaymentRecord, setSelectedPaymentRecord] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [settlementError, setSettlementError] = useState('');
  const [settlementSuccess, setSettlementSuccess] = useState('');
  const [settlementForm, setSettlementForm] = useState(emptySettlementForm);
  const [settlementPreview, setSettlementPreview] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setPaymentRecords([]);
      setSummary({ count: 0, paidAmount: 0, incomeTotal: 0, expenseTotal: 0, fineTotal: 0, netPayable: 0 });
      setSearch('');
      setSelectedPaymentRecord(null);
      setSelectedApplicant(null);
      setSettlementForm(emptySettlementForm);
      setSettlementPreview(null);
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
    setSelectedPaymentRecord(null);
    setSelectedApplicant(null);
    setSettlementForm(emptySettlementForm);
    setSettlementPreview(null);
  };

  const closeSettlementModal = () => {
    setSelectedPaymentRecord(null);
    setSelectedApplicant(null);
    setSettlementLoading(false);
    setSettlementSaving(false);
    setSettlementError('');
    setSettlementSuccess('');
    setSettlementForm(emptySettlementForm);
    setSettlementPreview(null);
  };

  const openSettlementModal = async record => {
    const applicantId = record?.applicantId?._id || record?.applicantId;
    if (!applicantId) {
      setError('Unable to open settlement details for this record');
      return;
    }

    setSelectedPaymentRecord(record);
    setSelectedApplicant(null);
    setSettlementLoading(true);
    setSettlementError('');
    setSettlementSuccess('');
    setSettlementPreview(null);
    setSettlementForm({
      fromDate: record.fromDate ? String(record.fromDate).slice(0, 10) : '',
      toDate: record.toDate ? String(record.toDate).slice(0, 10) : '',
      paidAmount: String(record.paidAmount ?? ''),
      notes: record.notes || '',
    });

    try {
      const response = await fetchApplicant(applicantId);
      setSelectedApplicant(response.data?.applicant || null);
    } catch (loadError) {
      setSettlementError(loadError.message || 'Failed to load payout details');
    } finally {
      setSettlementLoading(false);
    }
  };

  const loadSettlementPreview = async nextForm => {
    const applicantId = selectedApplicant?._id;
    if (!applicantId || !nextForm.fromDate || !nextForm.toDate) {
      setSettlementPreview(null);
      setSettlementForm(current => ({ ...current, paidAmount: '' }));
      return;
    }

    try {
      const response = await fetchAdminPaymentPreview({
        applicantId,
        fromDate: nextForm.fromDate,
        toDate: nextForm.toDate,
      });
      const preview = response.data || null;
      setSettlementPreview(preview);
      setSettlementForm(current => ({
        ...current,
        paidAmount: preview?.netPayable !== undefined && preview?.netPayable !== null
          ? formatSettlementAmount(preview.netPayable)
          : '',
      }));
    } catch (previewError) {
      setSettlementPreview(null);
      setSettlementForm(current => ({ ...current, paidAmount: '' }));
      setSettlementError(previewError.message || 'Failed to load settlement preview');
    }
  };

  const handleSettlementFieldChange = field => event => {
    const value = event.target.value;
    setSettlementForm(current => {
      const nextForm = { ...current, [field]: value };
      if (settlementError) {
        setSettlementError('');
      }
      if (settlementSuccess) {
        setSettlementSuccess('');
      }
      return nextForm;
    });
  };

  useEffect(() => {
    if (!selectedApplicant?._id || !settlementForm.fromDate || !settlementForm.toDate) {
      setSettlementPreview(null);
      setSettlementForm(current => (current.paidAmount ? { ...current, paidAmount: '' } : current));
      return;
    }

    void loadSettlementPreview(settlementForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApplicant?._id, settlementForm.fromDate, settlementForm.toDate]);

  const handleCreateSettlement = async event => {
    event.preventDefault();

    if (!selectedApplicant?._id) {
      setSettlementError('Select an applicant first');
      return;
    }

    setSettlementSaving(true);
    setSettlementError('');
    setSettlementSuccess('');

    try {
      await createAdminPaymentRecord({
        applicantId: selectedApplicant._id,
        fromDate: settlementForm.fromDate,
        toDate: settlementForm.toDate,
        paidAmount: settlementForm.paidAmount,
        notes: settlementForm.notes,
      });

      setSettlementSuccess('Payment settlement created and email sent');
      await loadPayments();
      await openSettlementModal(selectedPaymentRecord);
      await loadSettlementPreview(settlementForm);
    } catch (createError) {
      setSettlementError(createError.message || 'Failed to create settlement');
    } finally {
      setSettlementSaving(false);
    }
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

  const paymentHistory = useMemo(() => {
    const applicantId = selectedPaymentRecord?.applicantId?._id || selectedPaymentRecord?.applicantId;
    if (!applicantId) {
      return [];
    }

    return paymentRecords
      .filter(record => {
        const recordApplicantId = record?.applicantId?._id || record?.applicantId;
        return String(recordApplicantId) === String(applicantId);
      })
      .slice()
      .sort((left, right) => new Date(right.paidAt || right.createdAt || 0) - new Date(left.paidAt || left.createdAt || 0));
  }, [paymentRecords, selectedPaymentRecord]);

  const handleExportExcel = () => {
    if (!filteredRecords.length) {
      setError('No payment records to export');
      return;
    }

    try {
      const rows = buildPaymentExportRows(filteredRecords);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 20 },
        { wch: 24 },
        { wch: 30 },
        { wch: 14 },
        { wch: 18 },
        { wch: 28 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 24 },
        { wch: 12 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Records');

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      anchor.href = url;
      anchor.download = `payment-records-${stamp}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError.message || 'Failed to export payment records');
    }
  };

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
          <div className="flex flex-col gap-3 sm:min-w-[320px] sm:items-end">
            <label className="block text-sm font-medium text-slate-700 sm:w-[320px]">
              Search
              <input
                className="input mt-2"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search name, picker ID, period, notes, or paid by"
              />
            </label>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || !filteredRecords.length}
              className="inline-flex items-center justify-center rounded-full bg-forest-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Download Excel
            </button>
          </div>
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
                    <tr
                      key={record._id}
                      className="cursor-pointer hover:bg-slate-50/70"
                      onClick={() => void openSettlementModal(record)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void openSettlementModal(record);
                        }
                      }}
                    >
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

      {selectedPaymentRecord ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3 py-3 sm:items-center sm:px-4 sm:py-6">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeSettlementModal} />
          <div className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Payment settlement</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedApplicant?.fullName || getApplicant(selectedPaymentRecord).fullName}</h3>
                <p className="mt-1 text-sm text-slate-500">Click to review payout details and create a new settlement from here.</p>
              </div>
              <button type="button" onClick={closeSettlementModal} className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="max-h-[calc(92vh-72px)] overflow-y-auto px-5 py-5 sm:px-6">
              {settlementLoading ? (
                <p className="text-sm text-slate-600">Loading payout details...</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Bank name</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedApplicant?.bankName || '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Account number</p>
                      <p className="mt-1 font-semibold text-slate-900 break-all">{selectedApplicant?.bankAccountNumber || '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Picker ID</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedApplicant?.pickerId || getApplicant(selectedPaymentRecord).pickerId || '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Group</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedApplicant?.groupName || getApplicant(selectedPaymentRecord).groupName || '—'}</p>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-soft">
                      <h4 className="text-base font-semibold text-slate-900">Payment history</h4>
                      <div className="mt-4 space-y-3">
                        {paymentHistory.length > 0 ? paymentHistory.slice(0, 3).map(item => (
                          <div key={item._id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <div className="flex items-center justify-between gap-3">
                              <span>{item.fromDate ? formatDateOnlyUtc(item.fromDate) : '—'} → {item.toDate ? formatDateOnlyUtc(item.toDate) : '—'}</span>
                              <span className="font-semibold text-forest-700">{formatEuro(item.paidAmount)}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">Paid on {item.paidAt ? formatDateTime(item.paidAt) : '—'}</p>
                          </div>
                        )) : (
                          <p className="text-sm text-slate-500">No prior payment history found.</p>
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleCreateSettlement} className="space-y-5 rounded-3xl border border-forest-100 bg-forest-50/60 p-4 shadow-soft">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-slate-900">Create settlement</h4>
                          <p className="text-sm text-slate-500">Use the current applicant data and send the payment email automatically.</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
                        <label className="block text-sm font-medium text-slate-700">
                          From date
                          <input className="input mt-2" type="date" value={settlementForm.fromDate} onChange={handleSettlementFieldChange('fromDate')} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          To date
                          <input className="input mt-2" type="date" value={settlementForm.toDate} onChange={handleSettlementFieldChange('toDate')} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Paid amount
                          <input className="input mt-2 bg-white" type="number" min="0" step="0.01" value={settlementForm.paidAmount} readOnly placeholder="Auto from preview" />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Notes
                          <textarea className="input mt-2 min-h-[92px]" value={settlementForm.notes} onChange={handleSettlementFieldChange('notes')} placeholder="Optional note for this payout" />
                        </label>
                      </div>

                      {settlementPreview ? (
                        <div className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Preview</p>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                            <div>
                              <p className="text-xs text-slate-400">Income</p>
                              <p className="font-semibold text-slate-900">{formatEuro(settlementPreview.incomeTotal)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Expense</p>
                              <p className="font-semibold text-slate-900">{formatEuro(settlementPreview.expenseTotal)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Fine</p>
                              <p className="font-semibold text-slate-900">{formatEuro(settlementPreview.fineTotal)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Net payable</p>
                              <p className="font-semibold text-forest-700">{formatEuro(settlementPreview.netPayable)}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {settlementError ? <p className="mt-3 text-sm text-rose-600">{settlementError}</p> : null}
                      {settlementSuccess ? <p className="mt-3 text-sm text-emerald-600">{settlementSuccess}</p> : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="submit" disabled={settlementSaving || settlementLoading || !selectedApplicant?._id} className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70">
                          {settlementSaving ? 'Saving…' : 'Create payment settlement'}
                        </button>
                        <button type="button" onClick={closeSettlementModal} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
                          Close
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
