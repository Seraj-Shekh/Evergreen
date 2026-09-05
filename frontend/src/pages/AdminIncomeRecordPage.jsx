import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import {
  addAdminIncomeRecordsBulk,
  adminLogin,
  clearAdminToken,
  deleteAdminIncomeRecord,
  fetchApplicant,
  fetchAdminIncomeRecords,
  fetchApplicants,
  getAdminToken,
} from '../lib/api.js';

const loginInitial = { username: '', password: '' };
const searchInitial = { pickerId: '' };
const berryTypeOptions = ['Blueberry', 'Cowberry', 'Cloudberry', 'Lingonberry'];
const cartTypes = [
  { id: 'cart1', label: 'Cart 1', weightPerCart: 1.06 },
  { id: 'cart2', label: 'Cart 2', weightPerCart: 1.25 },
  { id: 'cart3', label: 'Cart 3', weightPerCart: 1.30 },
];
const defaultCartTypeId = cartTypes[0].id;
const getCartTypeWeight = cartTypeId => cartTypes.find(type => type.id === cartTypeId)?.weightPerCart ?? cartTypes[0].weightPerCart;
const cartOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const parseDateInput = value => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const date = text.includes('T') ? new Date(text) : new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateInput = value => {
  const date = value instanceof Date ? value : parseDateInput(value);
  if (!date) {
    return '';
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysToDateInput = (value, days) => {
  const date = parseDateInput(value);
  if (!date) {
    return '';
  }

  date.setUTCDate(date.getUTCDate() + days);
  return formatDateInput(date);
};

const createIncomeRow = (seed = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  recordId: seed.recordId || '',
  date: seed.date || '',
  location: seed.location || 'Lieksa',
  berryType: seed.berryType || 'Blueberry',
  berryWeightKg: seed.berryWeightKg ?? '',
  carrotWeightKg: seed.carrotWeightKg || '0.00',
  cartMode: seed.cartMode || 'preset',
  cartType: seed.cartType || defaultCartTypeId,
  cartCount: seed.cartCount ?? '0',
  amount: seed.amount ?? '',
});

const formatNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
};

const formatEuro = value => `€${formatNumber(value)}`;
const todayDate = formatDateInput(new Date());

const formatDisplayDate = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/Helsinki',
  }).format(date);
};

const getCartPresetFromWeight = weightValue => {
  const weight = Number(weightValue);
  if (!Number.isFinite(weight) || weight < 0) {
    return { cartMode: 'custom', cartCount: 'custom', cartType: defaultCartTypeId };
  }

  for (const cartType of cartTypes) {
    for (const count of cartOptions) {
      if (Math.abs((count * cartType.weightPerCart) - weight) < 0.005) {
        return { cartMode: 'preset', cartCount: String(count), cartType: cartType.id };
      }
    }
  }

  return { cartMode: 'custom', cartCount: 'custom', cartType: defaultCartTypeId };
};

const calculateRowTotal = row => {
  const berryWeight = Number(row.berryWeightKg);
  const carrotWeight = Number(row.carrotWeightKg);
  const amount = Number(row.amount);

  if ([berryWeight, carrotWeight, amount].some(value => !Number.isFinite(value))) {
    return 0;
  }

  return (berryWeight - carrotWeight) * amount;
};

export default function AdminIncomeRecordPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [loginForm, setLoginForm] = useState(loginInitial);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [searchForm, setSearchForm] = useState(searchInitial);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState('');
  const [incomeRows, setIncomeRows] = useState([createIncomeRow()]);
  const [existingRecords, setExistingRecords] = useState([]);
  const [existingLoading, setExistingLoading] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState('');
  const [existingError, setExistingError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const estimatedTotal = useMemo(() => incomeRows.reduce((sum, row) => sum + calculateRowTotal(row), 0), [incomeRows]);

  const handleFieldChange = (rowId, field, value) => {
    setIncomeRows(current => current.map(row => {
      if (row.id !== rowId) {
        return row;
      }

      if (field === 'cartType') {
        if (row.cartMode === 'custom') {
          return { ...row, cartType: value };
        }

        const carrotWeightKg = formatNumber(Number(row.cartCount) * getCartTypeWeight(value));
        return { ...row, cartType: value, carrotWeightKg };
      }

      if (field === 'cartCount') {
        if (value === 'custom') {
          return { ...row, cartMode: 'custom', cartCount: value };
        }

        const cartCount = Number(value);
        const carrotWeightKg = formatNumber(cartCount * getCartTypeWeight(row.cartType));
        return { ...row, cartMode: 'preset', cartCount: value, carrotWeightKg };
      }

      if (field === 'carrotWeightKg') {
        return { ...row, cartMode: 'custom', cartCount: 'custom', carrotWeightKg: value };
      }

      return { ...row, [field]: value };
    }));
  };

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
    setSearchQuery('');
    setSearchError('');
    setIncomeRows([createIncomeRow()]);
    setExistingRecords([]);
    setExistingError('');
    setSaveError('');
    setSaveSuccess('');
  };

  const loadExistingRecords = async applicantId => {
    if (!applicantId) {
      setExistingRecords([]);
      return;
    }

    setExistingLoading(true);
    setExistingError('');

    try {
      const response = await fetchAdminIncomeRecords({ applicantId, page: 1, limit: 200 });
      setExistingRecords(response.data?.records || []);
    } catch (error) {
      setExistingRecords([]);
      setExistingError(error.message || 'Failed to load existing records');
    } finally {
      setExistingLoading(false);
    }
  };

  const handleEditExistingRecord = record => {
    const { cartMode, cartCount, cartType } = getCartPresetFromWeight(record.carrotWeightKg);

    setIncomeRows([
      createIncomeRow({
        recordId: record._id,
        date: formatDateInput(new Date(record.date)),
        location: record.location || 'Lieksa',
        berryType: record.berryType || 'Blueberry',
        carrotWeightKg: formatNumber(record.carrotWeightKg),
        cartMode,
        cartType,
        cartCount,
        berryWeightKg: String(record.berryWeightKg ?? ''),
        amount: String(record.amount ?? ''),
      }),
    ]);

    setSaveError('');
    setSaveSuccess(`Editing ${formatDisplayDate(record.date)} record. Update values and click Add all income records.`);
  };

  const handleDeleteExistingRecord = async record => {
    if (!record?._id) {
      return;
    }

    const confirmed = window.confirm(`Delete income record for ${formatDisplayDate(record.date)}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setExistingError('');
    setSaveError('');
    setSaveSuccess('');
    setDeletingRecordId(record._id);

    try {
      await deleteAdminIncomeRecord(record._id);
      setSaveSuccess(`Deleted income record for ${formatDisplayDate(record.date)}.`);
      if (selectedApplicant?._id) {
        await loadExistingRecords(selectedApplicant._id);
      }
    } catch (error) {
      setExistingError(error.message || 'Failed to delete income record');
    } finally {
      setDeletingRecordId('');
    }
  };

  const openApplicant = async applicant => {
    setSelectedLoading(true);
    setSelectedError('');

    try {
      const response = await fetchApplicant(applicant._id);
      setSelectedApplicant(response.data.applicant);
      setIncomeRows([createIncomeRow()]);
      await loadExistingRecords(response.data.applicant?._id || applicant._id);
      setSaveError('');
      setSaveSuccess('');
    } catch (error) {
      setSelectedError(error.message || 'Failed to load applicant details');
    } finally {
      setSelectedLoading(false);
    }
  };

  const loadApplicants = async pickerId => {
    const nextPickerId = String(pickerId || '').trim();
    setSearchQuery(nextPickerId);
    setSearchLoading(true);
    setSearchError('');
    setSelectedError('');
    setSelectedApplicant(null);
    setExistingRecords([]);
    setExistingError('');

    try {
      const response = await fetchApplicants({ pickerId: nextPickerId, limit: 20, page: 1, sortField: 'createdAt', sortDirection: 'desc' });
      const nextApplicants = response.data.applicants || [];
      setApplicants(nextApplicants);

      if (nextApplicants.length === 1) {
        await openApplicant(nextApplicants[0]);
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

    await loadApplicants(searchForm.pickerId);
  };

  const addRow = () => {
    setIncomeRows(current => {
      const lastRow = current[current.length - 1];
      const nextDate = lastRow?.date ? addDaysToDateInput(lastRow.date, 1) : '';

      return [...current, createIncomeRow({
        date: nextDate,
        location: lastRow?.location || 'Lieksa',
        berryType: lastRow?.berryType || 'Blueberry',
        carrotWeightKg: lastRow?.cartMode === 'custom' ? lastRow.carrotWeightKg : formatNumber(Number(lastRow?.cartCount || 0) * getCartTypeWeight(lastRow?.cartType || defaultCartTypeId)),
        cartMode: lastRow?.cartMode || 'preset',
        cartType: lastRow?.cartType || defaultCartTypeId,
        cartCount: lastRow?.cartCount ?? '0',
      })];
    });
  };

  const removeRow = rowId => {
    setIncomeRows(current => (current.length === 1 ? current : current.filter(row => row.id !== rowId)));
  };

  const handleSubmitAll = async event => {
    event.preventDefault();
    setSaveError('');
    setSaveSuccess('');

    if (!selectedApplicant?._id) {
      setSaveError('Select an applicant first');
      return;
    }

    if (!incomeRows.length) {
      setSaveError('Add at least one income row');
      return;
    }

    for (const [index, row] of incomeRows.entries()) {
      if (!row.date || !row.location || !row.berryType || row.berryWeightKg === '' || row.carrotWeightKg === '' || row.amount === '') {
        setSaveError(`Row ${index + 1} is incomplete`);
        return;
      }
    }

    setSaving(true);

    try {
      const response = await addAdminIncomeRecordsBulk({
        applicantId: selectedApplicant._id,
        records: incomeRows.map(row => ({
          recordId: row.recordId || undefined,
          date: row.date,
          location: row.location,
          berryType: row.berryType,
          berryWeightKg: row.berryWeightKg,
          carrotWeightKg: row.carrotWeightKg,
          amount: row.amount,
        })),
      });

      const createdCount = response.data?.createdCount || 0;
      const updatedCount = response.data?.updatedCount || 0;
      setSaveSuccess(`Saved ${createdCount} new and ${updatedCount} updated record(s).`);
      setIncomeRows([createIncomeRow()]);
      await loadExistingRecords(selectedApplicant._id);
    } catch (error) {
      setSaveError(error.message || 'Failed to save income records');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <h1 className="text-xl font-semibold text-slate-900">Income record</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to search a picker ID and add multiple income rows at once.</p>
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
            <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700">Income record</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Add multiple income rows</h1>
          <p className="mt-1 text-sm text-slate-600">Search by picker ID, add as many day rows as needed, then submit everything together.</p>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
          <form onSubmit={handleSearchSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Picker ID
              <input
                className="input mt-2"
                value={searchForm.pickerId}
                onChange={event => setSearchForm({ pickerId: event.target.value })}
                placeholder="P-0135"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={searchLoading}
                className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchForm(searchInitial);
                  setSearchQuery('');
                  setApplicants([]);
                  setSelectedApplicant(null);
                  setSelectedError('');
                  setSaveError('');
                  setSaveSuccess('');
                  setIncomeRows([createIncomeRow()]);
                  setExistingRecords([]);
                  setExistingError('');
                }}
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
            {searchError ? <p className="mt-3 text-sm text-rose-600">{searchError}</p> : null}
            {searchQuery ? <p className="mt-3 text-xs text-slate-500">Showing results for picker ID: {searchQuery}</p> : null}
          </form>

          <div className="mt-5 space-y-3">
            {applicants.length > 0 ? applicants.map(applicant => (
              <button
                key={applicant._id}
                type="button"
                onClick={() => openApplicant(applicant)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${selectedApplicant?._id === applicant._id ? 'border-forest-300 bg-forest-50' : 'border-slate-200 bg-white'}`}
              >
                <p className="font-semibold text-slate-900">{applicant.fullName}</p>
                <p className="mt-1 text-sm text-slate-500">{applicant.email}</p>
                <p className="mt-1 text-sm text-slate-600">Picker ID: {applicant.pickerId || '—'}</p>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Search by picker ID to load matching applicants.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-2 border-b border-forest-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Income rows</h2>
              <p className="text-sm text-slate-500">Add day-by-day records for the selected person.</p>
            </div>
            <div className="rounded-2xl bg-forest-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Estimated total</p>
              <p className="text-lg font-semibold text-forest-700">{formatEuro(estimatedTotal)}</p>
            </div>
          </div>

          {selectedLoading ? <p className="mt-5 text-sm text-slate-600">Loading detail…</p> : null}
          {selectedError ? <p className="mt-5 text-sm text-rose-600">{selectedError}</p> : null}

          {selectedApplicant ? (
            <div className="mt-5 space-y-4">
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

              <div className="space-y-4">
                {incomeRows.map((row, index) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">Day {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={incomeRows.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <label className="block text-sm font-medium text-slate-700">
                        Date
                        <input
                          className="input mt-2"
                          type="date"
                          max={todayDate}
                          value={row.date}
                          onChange={event => handleFieldChange(row.id, 'date', event.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Location
                        <input
                          className="input mt-2"
                          value={row.location}
                          onChange={event => handleFieldChange(row.id, 'location', event.target.value)}
                          placeholder="Lieksa"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Berry type
                        <select
                          className="input mt-2"
                          value={row.berryType}
                          onChange={event => handleFieldChange(row.id, 'berryType', event.target.value)}
                        >
                          {berryTypeOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Cart type
                        <select
                          className="input mt-2"
                          value={row.cartType}
                          onChange={event => handleFieldChange(row.id, 'cartType', event.target.value)}
                        >
                          {cartTypes.map(type => (
                            <option key={type.id} value={type.id}>
                              {type.label} ({formatNumber(type.weightPerCart)} kg/cart)
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Cart wt
                        <select
                          className="input mt-2"
                          value={row.cartMode === 'custom' ? 'custom' : row.cartCount}
                          onChange={event => handleFieldChange(row.id, 'cartCount', event.target.value)}
                        >
                          {cartOptions.map(option => (
                            <option key={option} value={option}>
                              {option} cart ({formatNumber(option * getCartTypeWeight(row.cartType))})
                            </option>
                          ))}
                          <option value="custom">Custom</option>
                        </select>
                        {row.cartMode === 'custom' ? (
                          <input
                            className="input mt-2"
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.carrotWeightKg}
                            onChange={event => handleFieldChange(row.id, 'carrotWeightKg', event.target.value)}
                            placeholder="Enter cart weight manually"
                          />
                        ) : null}
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Berry wt
                        <input
                          className="input mt-2"
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.berryWeightKg}
                          onChange={event => handleFieldChange(row.id, 'berryWeightKg', event.target.value)}
                          placeholder="0.00"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Amount
                        <input
                          className="input mt-2"
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={event => handleFieldChange(row.id, 'amount', event.target.value)}
                          placeholder="0.00"
                        />
                      </label>
                    </div>
                    <div className="mt-3 text-right text-sm text-slate-600">
                      Estimated income: <span className="font-semibold text-forest-700">{formatEuro(calculateRowTotal(row))}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-full border border-forest-200 bg-white px-4 py-2.5 text-sm font-semibold text-forest-700 transition hover:bg-forest-50"
                >
                  + Add row
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeRows([createIncomeRow()])}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Reset rows
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAll}
                  disabled={saving}
                  className="rounded-full bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Add all income records'}
                </button>
              </div>

              {saveError ? <p className="text-sm text-rose-600">{saveError}</p> : null}
              {saveSuccess ? <p className="text-sm text-emerald-600">{saveSuccess}</p> : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Existing income records</h3>
                    <p className="text-sm text-slate-500">Use Edit to load a record into the form and update it.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{existingRecords.length}</span>
                </div>

                {existingLoading ? <p className="mt-3 text-sm text-slate-600">Loading records…</p> : null}
                {existingError ? <p className="mt-3 text-sm text-rose-600">{existingError}</p> : null}

                {!existingLoading && existingRecords.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Date</th>
                          <th className="px-3 py-2 font-semibold">Location</th>
                          <th className="px-3 py-2 font-semibold">Berry</th>
                          <th className="px-3 py-2 font-semibold">Berry wt</th>
                          <th className="px-3 py-2 font-semibold">Cart wt</th>
                          <th className="px-3 py-2 font-semibold">Amount</th>
                          <th className="px-3 py-2 font-semibold">Income</th>
                          <th className="px-3 py-2 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {existingRecords.map(record => (
                          <tr key={record._id}>
                            <td className="px-3 py-2 text-slate-700">{formatDisplayDate(record.date)}</td>
                            <td className="px-3 py-2 text-slate-700">{record.location || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{record.berryType || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{formatNumber(record.berryWeightKg)}</td>
                            <td className="px-3 py-2 text-slate-700">{formatNumber(record.carrotWeightKg)}</td>
                            <td className="px-3 py-2 text-slate-700">{formatEuro(record.amount)}</td>
                            <td className="px-3 py-2 font-semibold text-forest-700">{formatEuro(record.calculatedIncome)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditExistingRecord(record)}
                                  className="rounded-full border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-700 transition hover:bg-forest-50"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExistingRecord(record)}
                                  disabled={deletingRecordId === record._id}
                                  className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {deletingRecordId === record._id ? 'Deleting…' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {!existingLoading && existingRecords.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No existing income records found for this applicant.</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Select a picker from the left panel to start adding income rows.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
