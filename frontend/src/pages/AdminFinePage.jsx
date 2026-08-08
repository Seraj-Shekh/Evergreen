import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import {
  adminLogin,
  downloadProtectedFile,
  clearAdminToken,
  createAdminFineRecords,
  deleteAdminFineRecord,
  fetchAdminFineRecords,
  fetchApplicants,
  getAdminToken,
  updateAdminFineRecord,
} from '../lib/api.js';

const loginInitial = { username: '', password: '' };
const searchInitial = { pickerId: '', name: '' };
const today = new Date().toISOString().slice(0, 10);

const formatCurrency = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);

const formatDate = value => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Helsinki',
}).format(new Date(value));

const formatDateOnly = value => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'UTC',
}).format(new Date(value));

const splitMoneyEvenly = (value, count) => {
  const safeCount = Math.max(1, Number.parseInt(count, 10) || 1);
  const totalCents = Math.max(0, Math.round(Number(value || 0) * 100));
  const baseCents = Math.floor(totalCents / safeCount);
  let remainder = totalCents - (baseCents * safeCount);

  return Array.from({ length: safeCount }, () => {
    const cents = baseCents + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }

    return cents / 100;
  });
};

const calculateVatAmount = (amount, vatPercent) => {
  const parsedAmount = Number(amount);
  const parsedVatPercent = Number(vatPercent);

  if (!Number.isFinite(parsedAmount) || !Number.isFinite(parsedVatPercent)) {
    return 0;
  }

  return Math.round((parsedAmount * parsedVatPercent) * 100) / 10000;
};

const calculateNetAmount = (amount, vatPercent) => {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) {
    return 0;
  }

  return Math.round((parsedAmount + calculateVatAmount(amount, vatPercent)) * 100) / 100;
};

const fileToAttachment = file => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => {
    const result = String(reader.result || '');
    resolve({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      data: result.includes('base64,') ? result.split('base64,').pop() : result,
    });
  };

  reader.onerror = () => reject(new Error('Unable to read attachment'));
  reader.readAsDataURL(file);
});

export default function AdminFinePage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [loginForm, setLoginForm] = useState(loginInitial);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [searchForm, setSearchForm] = useState(searchInitial);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [selectedApplicants, setSelectedApplicants] = useState([]);
  const [fineRecords, setFineRecords] = useState([]);
  const [fineSummary, setFineSummary] = useState({ count: 0, sourceAmount: 0, sourceVatAmount: 0, sourceNetAmount: 0, netAmount: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [fineForm, setFineForm] = useState({
    id: '',
    date: today,
    reason: '',
    amount: '',
    vatPercent: '0',
    attachment: null,
  });

  const selectedApplicantIds = useMemo(() => selectedApplicants.map(applicant => applicant._id), [selectedApplicants]);
  const vatAmountPreview = useMemo(() => calculateVatAmount(fineForm.amount, fineForm.vatPercent), [fineForm.amount, fineForm.vatPercent]);
  const netAmountPreview = useMemo(() => calculateNetAmount(fineForm.amount, fineForm.vatPercent), [fineForm.amount, fineForm.vatPercent]);
  const perPickerSharePreview = useMemo(() => {
    if (!selectedApplicantIds.length) {
      return [];
    }

    return splitMoneyEvenly(netAmountPreview, selectedApplicantIds.length);
  }, [netAmountPreview, selectedApplicantIds.length]);

  useEffect(() => {
    if (!isAuthenticated) {
      setApplicants([]);
      setSelectedApplicants([]);
      setFineRecords([]);
      setFineSummary({ count: 0, sourceAmount: 0, sourceVatAmount: 0, sourceNetAmount: 0, netAmount: 0 });
    }
  }, [isAuthenticated]);

  const loadFineData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchAdminFineRecords();
      setFineRecords(response.data?.fineRecords || []);
      setFineSummary(response.data?.summary || { count: 0, sourceAmount: 0, sourceVatAmount: 0, sourceNetAmount: 0, netAmount: 0 });
    } catch (loadError) {
      setFineRecords([]);
      setFineSummary({ count: 0, sourceAmount: 0, sourceVatAmount: 0, sourceNetAmount: 0, netAmount: 0 });
      setError(loadError.message || 'Failed to load fine records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadFineData();
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
    } catch (loginError) {
      setLoginError(loginError.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    setApplicants([]);
    setSelectedApplicants([]);
    setFineRecords([]);
  };

  const loadApplicants = async () => {
    const query = {};
    if (searchForm.pickerId.trim()) {
      query.pickerId = searchForm.pickerId.trim();
    }
    if (searchForm.name.trim()) {
      query.name = searchForm.name.trim();
    }

    if (!Object.keys(query).length) {
      setSearchError('Enter a picker ID or name to search');
      return;
    }

    setSearchLoading(true);
    setSearchError('');

    try {
      const response = await fetchApplicants({ ...query, limit: 20, page: 1, sortField: 'createdAt', sortDirection: 'desc' });
      setApplicants(response.data?.applicants || []);
    } catch (loadError) {
      setApplicants([]);
      setSearchError(loadError.message || 'Failed to load applicants');
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleApplicant = applicant => {
    setSelectedApplicants(current => {
      const exists = current.some(item => item._id === applicant._id);
      if (exists) {
        return current.filter(item => item._id !== applicant._id);
      }

      return [...current, applicant];
    });
  };

  const removeSelectedApplicant = applicantId => {
    setSelectedApplicants(current => current.filter(applicant => applicant._id !== applicantId));
  };

  const resetForm = () => {
    setFineForm({ id: '', date: today, reason: '', amount: '', vatPercent: '0', attachment: null });
    setSelectedApplicants([]);
  };

  const handleEditRecord = record => {
    const applicant = record.applicantId && typeof record.applicantId === 'object' ? record.applicantId : null;
    setSuccess('');
    setError('');
    setFineForm({
      id: record._id,
      date: record.date ? String(record.date).slice(0, 10) : today,
      reason: record.reason || '',
      amount: String(record.amount ?? ''),
      vatPercent: String(record.vatPercent ?? 0),
      attachment: record.attachment ? { ...record.attachment } : null,
    });
    setSelectedApplicants(applicant ? [applicant] : []);
  };

  const handleAttachmentChange = async event => {
    const file = event.target.files?.[0];
    if (!file) {
      setFineForm(current => ({ ...current, attachment: null }));
      return;
    }

    const attachment = await fileToAttachment(file);
    setFineForm(current => ({ ...current, attachment }));
  };

  const handleSubmitFine = async event => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedApplicants.length) {
      setError('Select at least one picker');
      return;
    }

    if (!fineForm.reason.trim()) {
      setError('Reason is required');
      return;
    }

    if (!fineForm.amount || Number(fineForm.amount) < 0) {
      setError('Amount must be a non-negative number');
      return;
    }

    if (!fineForm.attachment?.data) {
      setError('Upload a PDF or photo attachment');
      return;
    }

    setSaving(true);

    try {
      if (fineForm.id) {
        await updateAdminFineRecord(fineForm.id, {
          date: fineForm.date,
          reason: fineForm.reason,
          amount: fineForm.amount,
          vatPercent: fineForm.vatPercent,
          attachment: fineForm.attachment,
        });
        setSuccess('Fine record updated');
      } else {
        await createAdminFineRecords({
          applicantIds: selectedApplicantIds,
          date: fineForm.date,
          reason: fineForm.reason,
          amount: fineForm.amount,
          vatPercent: fineForm.vatPercent,
          attachment: fineForm.attachment,
        });
        setSuccess('Fine records created and split equally');
      }

      resetForm();
      await loadFineData();
    } catch (saveError) {
      setError(saveError.message || 'Failed to save fine record');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async record => {
    const confirmed = window.confirm(`Delete the fine for ${record.applicantId?.fullName || 'this picker'}?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await deleteAdminFineRecord(record._id);
      if (fineForm.id === record._id) {
        resetForm();
      }
      setSuccess('Fine record deleted');
      await loadFineData();
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete fine record');
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = record => {
    const attachment = record.attachment;
    if (!attachment?.data) {
      return;
    }

    void downloadProtectedFile({
      path: `/api/admin/fines/${record._id}/attachment`,
      token: getAdminToken(),
      filename: attachment?.filename || 'attachment',
      openInNewTab: true,
    }).catch(downloadError => {
      setError(downloadError.message || 'Failed to open attachment');
    });
  };

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <h1 className="text-xl font-semibold text-slate-900">Fine management</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to create and manage picker fines.</p>
          <form className="mt-6 space-y-4 text-left" onSubmit={handleLoginSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Username
              <input className="input mt-2" value={loginForm.username} onChange={event => setLoginForm(current => ({ ...current, username: event.target.value }))} autoComplete="username" required />
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
            <button type="submit" disabled={loginLoading} className="w-full rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70">
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
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => navigate('/admin')} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Back to admin</button>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">Fine management</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Picker fines with attachment proof</h1>
          <p className="mt-1 text-sm text-slate-600">Search multiple pickers, upload a PDF or photo, and split the net fine equally across everyone selected.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={loadFineData} className="rounded-full border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50">Refresh</button>
          <button type="button" onClick={handleLogout} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Logout</button>
          <Link to="/admin/payment-record" className="rounded-full border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50">Payment record</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Fine records</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{fineSummary.count || 0}</p>
        </div>
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Base amount</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{formatCurrency(fineSummary.sourceAmount || 0)}</p>
        </div>
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">VAT amount</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{formatCurrency(fineSummary.sourceVatAmount || 0)}</p>
        </div>
        <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-slate-500">Net deduction</p>
          <p className="mt-2 text-2xl font-semibold text-forest-700">{formatCurrency(fineSummary.netAmount || 0)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
          <form onSubmit={async event => { event.preventDefault(); await loadApplicants(); }} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Find pickers</h2>
              <p className="text-sm text-slate-500">Search by picker ID or name.</p>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Picker ID
              <input className="input mt-2" value={searchForm.pickerId} onChange={event => setSearchForm(current => ({ ...current, pickerId: event.target.value }))} placeholder="P-0016" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input className="input mt-2" value={searchForm.name} onChange={event => setSearchForm(current => ({ ...current, name: event.target.value }))} placeholder="Search by name" />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={searchLoading} className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70">
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
              <button type="button" onClick={() => { setSearchForm(searchInitial); setApplicants([]); setSearchError(''); }} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Clear
              </button>
            </div>
            {searchError ? <p className="text-sm text-rose-600">{searchError}</p> : null}
          </form>

          <div className="mt-5 space-y-3">
            {applicants.length > 0 ? applicants.map(applicant => {
              const selected = selectedApplicants.some(item => item._id === applicant._id);
              return (
                <button key={applicant._id} type="button" onClick={() => toggleApplicant(applicant)} className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${selected ? 'border-forest-300 bg-forest-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{applicant.fullName}</p>
                      <p className="text-xs text-slate-500">{applicant.email}</p>
                      <p className="text-xs text-slate-500">{applicant.pickerId || '—'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{selected ? 'Selected' : 'Add'}</span>
                  </div>
                </button>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Search by picker ID or name to add people to the fine list.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Selected pickers</h3>
                <p className="text-xs text-slate-500">{selectedApplicants.length ? `${selectedApplicants.length} picker${selectedApplicants.length === 1 ? '' : 's'} selected` : 'No pickers selected yet'}</p>
              </div>
              <button type="button" onClick={() => setSelectedApplicants([])} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                Clear all
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {selectedApplicants.length > 0 ? selectedApplicants.map(applicant => (
                <div key={applicant._id} className="rounded-2xl bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{applicant.fullName}</p>
                      <p className="text-xs text-slate-500">{applicant.pickerId || '—'} · {applicant.groupName || 'No group'}</p>
                    </div>
                    <button type="button" onClick={() => removeSelectedApplicant(applicant._id)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                      Remove
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No one selected yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
          <form onSubmit={handleSubmitFine} className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add fine</h2>
                <p className="text-sm text-slate-500">The net total will be divided evenly across the selected pickers.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Per picker share</p>
                <p className="text-lg font-semibold text-forest-700">{selectedApplicants.length ? formatCurrency(perPickerSharePreview[0] || 0) : '—'}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Date
                <input className="input mt-2" type="date" max={today} value={fineForm.date} onChange={event => setFineForm(current => ({ ...current, date: event.target.value }))} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Amount
                <input className="input mt-2" type="number" min="0" step="0.01" value={fineForm.amount} onChange={event => setFineForm(current => ({ ...current, amount: event.target.value }))} placeholder="200" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                VAT %
                <input className="input mt-2" type="number" min="0" step="0.01" value={fineForm.vatPercent} onChange={event => setFineForm(current => ({ ...current, vatPercent: event.target.value }))} placeholder="24" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Attachment
                <input className="input mt-2" type="file" accept="image/*,application/pdf" onChange={handleAttachmentChange} />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Reason
              <textarea className="input mt-2 min-h-28" value={fineForm.reason} onChange={event => setFineForm(current => ({ ...current, reason: event.target.value }))} placeholder="Explain the fine" />
            </label>

            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Amount</p>
                <p className="mt-1 font-semibold text-slate-900">{formatCurrency(fineForm.amount || 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">VAT amount</p>
                <p className="mt-1 font-semibold text-slate-900">{formatCurrency(vatAmountPreview)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Net amount</p>
                <p className="mt-1 font-semibold text-forest-700">{formatCurrency(netAmountPreview)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Split</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedApplicants.length ? `${selectedApplicants.length} picker${selectedApplicants.length === 1 ? '' : 's'}` : 'Select pickers'}</p>
              </div>
            </div>

            {fineForm.attachment ? (
              <div className="rounded-2xl border border-dashed border-forest-200 bg-forest-50 p-4 text-sm text-slate-700">
                Attachment loaded: <span className="font-semibold text-slate-900">{fineForm.attachment.filename}</span>
                {fineForm.attachment.mimeType ? <span className="ml-2 text-slate-500">({fineForm.attachment.mimeType})</span> : null}
              </div>
            ) : null}

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70">
                {saving ? (fineForm.id ? 'Saving…' : 'Adding…') : (fineForm.id ? 'Update fine' : 'Add fine')}
              </button>
              {fineForm.id ? (
                <button type="button" onClick={resetForm} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <div className="mt-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Fine history</h3>
                <p className="text-sm text-slate-500">Each picker gets its own fine record so it can be edited individually later.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">{fineRecords.length} rows</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Picker</th>
                      <th className="px-4 py-3 font-semibold">Reason</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">VAT</th>
                      <th className="px-4 py-3 font-semibold">Net</th>
                      <th className="px-4 py-3 font-semibold">Attachment</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {!loading && fineRecords.length > 0 ? fineRecords.map(record => (
                      <tr key={record._id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-slate-700">{record.date ? formatDateOnly(record.date) : '—'}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <p className="font-semibold text-slate-900">{record.applicantId?.fullName || '—'}</p>
                          <p className="text-xs text-slate-500">{record.applicantId?.pickerId || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{record.reason || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(record.amount || 0)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(record.vatAmount || 0)}</td>
                        <td className="px-4 py-3 font-semibold text-forest-700">{formatCurrency(record.netAmount || 0)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {record.attachment?.filename || record.attachment?.data ? (
                            <button type="button" onClick={() => openAttachment(record)} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-700 transition hover:bg-forest-50">
                              <span aria-hidden="true">⬇</span>
                              Download
                            </button>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => handleEditRecord(record)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDeleteRecord(record)} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : null}
                    {!loading && fineRecords.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan="8">No fine records found yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}