import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import PasswordField from '../components/PasswordField.jsx';
import { adminLogin, clearAdminToken, fetchAdminDailyBerryPicked, fetchAdminSeasonAnalytics, getAdminToken } from '../lib/api.js';

const loginInitial = { username: '', password: '' };
const emptyRangeForm = { fromDate: '', toDate: '' };

const formatDateOnlyUtc = value => {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
};

const toDateInputValue = value => {
  if (!value) {
    return '';
  }

  return new Date(value).toISOString().slice(0, 10);
};

const formatNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
};

const formatEuro = value => `€${formatNumber(value)}`;
const formatKg = value => `${formatNumber(value)} kg`;

const roundTo2 = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const downloadWorkbook = (workbook, filenamePrefix) => {
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  anchor.href = url;
  anchor.download = `${filenamePrefix}-${stamp}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const buildPickerExportRows = pickers => pickers.map(picker => ({
  Picker: picker.fullName,
  Email: picker.email,
  'Picker ID': picker.pickerId || '',
  Group: picker.groupName || '',
  'Days worked': picker.daysWorked,
  'Kg picked': roundTo2(picker.kgPicked),
  'Kg per day': roundTo2(picker.kgPickedPerDay),
  'Gross (EUR)': roundTo2(picker.grossEarnings),
  'Expense (EUR)': roundTo2(picker.expenseTotal),
  'Fine (EUR)': roundTo2(picker.fineTotal),
  'Net (EUR)': roundTo2(picker.netEarnings),
  'Net per day (EUR)': roundTo2(picker.netPerDay),
}));

const buildDailyBerryExportRows = data => {
  const rows = data.dailyBerryPicked.map(day => {
    const row = { Date: formatDateOnlyUtc(day.date) };
    data.berryTypes.forEach(type => {
      row[`${type} (kg)`] = roundTo2(day.byType[type] || 0);
    });
    row['Total (kg)'] = roundTo2(day.totalKg);
    return row;
  });

  const totalsRow = { Date: 'TOTAL' };
  data.berryTypes.forEach(type => {
    totalsRow[`${type} (kg)`] = roundTo2(data.totalsByType[type] || 0);
  });
  totalsRow['Total (kg)'] = roundTo2(data.totalKg);
  rows.push(totalsRow);

  return rows;
};

const buildBerryTypeSummaryRows = breakdown => breakdown.map(berry => ({
  'Berry type': berry.berryType,
  'Record count': berry.recordCount,
  'Total kg': roundTo2(berry.totalKg),
  'Total paid (EUR)': roundTo2(berry.totalPaid),
  'Weighted avg price (EUR/kg)': roundTo2(berry.weightedAveragePricePerKg),
  'Simple avg price (EUR/kg)': roundTo2(berry.simpleAveragePricePerKg),
  'Lowest price (EUR/kg)': roundTo2(berry.minPricePerKg),
  'Highest price (EUR/kg)': roundTo2(berry.maxPricePerKg),
  'First picked': formatDateOnlyUtc(berry.firstPickedDate),
  'Last picked': formatDateOnlyUtc(berry.lastPickedDate),
}));

const buildBerryTypeRateRangeRows = breakdown => {
  const rows = [];
  breakdown.forEach(berry => {
    berry.priceRanges.forEach(range => {
      rows.push({
        'Berry type': berry.berryType,
        'From date': formatDateOnlyUtc(range.fromDate),
        'To date': formatDateOnlyUtc(range.toDate),
        'Rate (EUR/kg)': roundTo2(range.ratePerKg),
      });
    });
  });
  return rows;
};

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [loginForm, setLoginForm] = useState(loginInitial);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [rangeForm, setRangeForm] = useState(emptyRangeForm);
  const [appliedRange, setAppliedRange] = useState(emptyRangeForm);

  // Independent of the season-wide reporting period above - this section has its own date
  // filter so it can be checked for a specific window without changing any other figure on the page.
  const [dailyRangeForm, setDailyRangeForm] = useState(emptyRangeForm);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState('');
  const [dailyData, setDailyData] = useState(null);

  const loadAnalytics = async params => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchAdminSeasonAnalytics(params || {});
      setAnalytics(response.data);

      const resolvedFrom = toDateInputValue(response.data?.range?.fromDate);
      const resolvedTo = toDateInputValue(response.data?.range?.toDate);
      setRangeForm({ fromDate: resolvedFrom, toDate: resolvedTo });
      setAppliedRange({ fromDate: resolvedFrom, toDate: resolvedTo });
    } catch (loadError) {
      setAnalytics(null);
      setError(loadError.message || 'Failed to load season analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadDailyBerryPicked = async params => {
    setDailyLoading(true);
    setDailyError('');

    try {
      const response = await fetchAdminDailyBerryPicked(params || {});
      setDailyData(response.data);
    } catch (loadError) {
      setDailyData(null);
      setDailyError(loadError.message || 'Failed to load daily berry picked');
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadAnalytics();
      void loadDailyBerryPicked();
    } else {
      setAnalytics(null);
      setRangeForm(emptyRangeForm);
      setAppliedRange(emptyRangeForm);
      setDailyData(null);
      setDailyRangeForm(emptyRangeForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleApplyDailyRange = event => {
    event.preventDefault();

    if (dailyRangeForm.fromDate && dailyRangeForm.toDate && dailyRangeForm.toDate < dailyRangeForm.fromDate) {
      setDailyError('End date cannot be earlier than start date.');
      return;
    }

    void loadDailyBerryPicked(dailyRangeForm);
  };

  const handleResetDailyRange = () => {
    setDailyRangeForm(emptyRangeForm);
    void loadDailyBerryPicked({});
  };

  const handleExportPickers = () => {
    if (!analytics?.pickers?.length) {
      setError('No picker data to export');
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(buildPickerExportRows(analytics.pickers));
      worksheet['!cols'] = [
        { wch: 24 }, { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Per-Picker Breakdown');
      downloadWorkbook(workbook, 'per-picker-breakdown');
    } catch (exportError) {
      setError(exportError.message || 'Failed to export per-picker breakdown');
    }
  };

  const handleExportDailyBerryPicked = () => {
    if (!dailyData?.dailyBerryPicked?.length) {
      setDailyError('No daily data to export');
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(buildDailyBerryExportRows(dailyData));
      worksheet['!cols'] = [{ wch: 16 }, ...dailyData.berryTypes.map(() => ({ wch: 16 })), { wch: 16 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Berries Picked Per Day');
      downloadWorkbook(workbook, 'berries-picked-per-day');
    } catch (exportError) {
      setDailyError(exportError.message || 'Failed to export berries picked per day');
    }
  };

  const handleExportBerryTypes = () => {
    if (!analytics?.berryTypeBreakdown?.length) {
      setError('No berry type data to export');
      return;
    }

    try {
      const summarySheet = XLSX.utils.json_to_sheet(buildBerryTypeSummaryRows(analytics.berryTypeBreakdown));
      summarySheet['!cols'] = [
        { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ];

      const rateRows = buildBerryTypeRateRangeRows(analytics.berryTypeBreakdown);
      const rateSheet = XLSX.utils.json_to_sheet(rateRows);
      rateSheet['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Berry Type Summary');
      XLSX.utils.book_append_sheet(workbook, rateSheet, 'Rate By Period');
      downloadWorkbook(workbook, 'berry-types-picked');
    } catch (exportError) {
      setError(exportError.message || 'Failed to export berry types picked');
    }
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
    setAnalytics(null);
    setError('');
  };

  const handleApplyRange = event => {
    event.preventDefault();

    if (rangeForm.fromDate && rangeForm.toDate && rangeForm.toDate < rangeForm.fromDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    void loadAnalytics(rangeForm);
  };

  const handleResetRange = () => {
    void loadAnalytics({});
  };

  if (!isAuthenticated) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-forest-600 text-white">EB</div>
          <h1 className="text-xl font-semibold text-slate-900">Season analytics</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to review season-wide earnings and pricing figures.</p>
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
            <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700">Analytics</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Season analytics</h1>
          <p className="mt-1 text-sm text-slate-600">Earnings and pricing figures for the harvesting season, for authority reporting.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadAnalytics(appliedRange)}
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
          <Link
            to="/admin"
            className="rounded-full border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50"
          >
            Applicant admin
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-slate-900">Reporting period</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every figure below is scoped to this date range. Recorded income spans
          {' '}{formatDateOnlyUtc(analytics?.availableRange?.minDate)} to {formatDateOnlyUtc(analytics?.availableRange?.maxDate)}.
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleApplyRange}>
          <label className="block text-sm font-medium text-slate-700">
            From date
            <input
              className="input mt-2"
              type="date"
              value={rangeForm.fromDate}
              onChange={event => setRangeForm(current => ({ ...current, fromDate: event.target.value }))}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            To date
            <input
              className="input mt-2"
              type="date"
              value={rangeForm.toDate}
              onChange={event => setRangeForm(current => ({ ...current, toDate: event.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Loading…' : 'Apply range'}
          </button>
          <button
            type="button"
            onClick={handleResetRange}
            disabled={loading}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Use full season
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        {analytics ? (
          <p className="mt-4 rounded-2xl bg-forest-50 px-4 py-3 text-sm font-medium text-forest-800">
            Showing figures for {formatDateOnlyUtc(analytics.range.fromDate)} → {formatDateOnlyUtc(analytics.range.toDate)},
            {' '}covering {analytics.pickerCount} picker{analytics.pickerCount === 1 ? '' : 's'} with recorded income in this period.
          </p>
        ) : null}
      </div>

      {analytics ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pickers</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.pickerCount}</p>
            </div>
            <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total gross</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatEuro(analytics.totals.grossEarnings)}</p>
            </div>
            <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total net</p>
              <p className="mt-2 text-2xl font-semibold text-forest-700">{formatEuro(analytics.totals.netEarnings)}</p>
            </div>
            <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total expense + fine</p>
              <p className="mt-2 text-2xl font-semibold text-rose-700">{formatEuro(analytics.totals.expenseTotal + analytics.totals.fineTotal)}</p>
            </div>
            <div className="rounded-3xl border border-forest-100 bg-white p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total picker-days worked</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.totals.daysWorked}</p>
              <p className="mt-1 text-xs text-slate-500">Sum of every picker's own days worked, not a calendar count</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-slate-900">Gross earnings per picker</h2>
              <p className="mt-1 text-sm text-slate-500">
                Sum of all recorded income per picker for the season, before any expense or fine deductions.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-forest-50 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Average</p>
                  <p className="mt-1 text-xl font-semibold text-forest-800">{formatEuro(analytics.grossEarningsPerPicker.averagePerPicker)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Lowest</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800">{formatEuro(analytics.grossEarningsPerPicker.min)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Highest</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800">{formatEuro(analytics.grossEarningsPerPicker.max)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-slate-900">Net earnings per picker</h2>
              <p className="mt-1 text-sm text-slate-500">
                Gross income minus accommodation/transport expense deductions minus fines, per picker, for the season.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-forest-50 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Average</p>
                  <p className="mt-1 text-xl font-semibold text-forest-800">{formatEuro(analytics.netEarningsPerPicker.averagePerPicker)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Lowest</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800">{formatEuro(analytics.netEarningsPerPicker.min)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Highest</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800">{formatEuro(analytics.netEarningsPerPicker.max)}</p>
                </div>
              </div>
              {analytics.netEarningsPerPicker.min < 0 ? (
                <p className="mt-3 text-xs text-amber-700">
                  Note: at least one picker shows negative net earnings. This happens when accommodation/transport costs accrue for every
                  day on their expense plan, even days they did not pick.
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Net earnings per picker, per day</h2>
              <p className="mt-1 text-sm text-slate-500">
                Shown two ways since pickers worked different numbers of days this season:
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-forest-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Average of each picker's own daily rate</p>
                  <p className="mt-1 text-xl font-semibold text-forest-800">{formatEuro(analytics.netEarningsPerPickerPerDay.averageOfPerPickerDailyAverages)} / day</p>
                  <p className="mt-1 text-xs text-slate-500">Each picker's (net earnings ÷ their own days worked), then averaged across all pickers.</p>
                </div>
                <div className="rounded-2xl bg-forest-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Season-wide weighted average</p>
                  <p className="mt-1 text-xl font-semibold text-forest-800">{formatEuro(analytics.netEarningsPerPickerPerDay.aggregateWeightedAverage)} / day</p>
                  <p className="mt-1 text-xs text-slate-500">Total net earnings across all pickers ÷ total picker-days worked ({analytics.totals.daysWorked}).</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-forest-100 bg-white p-5 shadow-soft lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Berries picked per picker, per day</h2>
              <p className="mt-1 text-sm text-slate-500">
                All berry types combined, shown the same two ways as net earnings per day above:
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-forest-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Average of each picker's own daily rate</p>
                  <p className="mt-1 text-xl font-semibold text-forest-800">{formatKg(analytics.berryPickedPerPickerPerDay.averageOfPerPickerDailyAverages)} / day</p>
                  <p className="mt-1 text-xs text-slate-500">Each picker's (kg picked ÷ their own days worked), then averaged across all pickers.</p>
                </div>
                <div className="rounded-2xl bg-forest-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Season-wide weighted average</p>
                  <p className="mt-1 text-xl font-semibold text-forest-800">{formatKg(analytics.berryPickedPerPickerPerDay.aggregateWeightedAverage)} / day</p>
                  <p className="mt-1 text-xs text-slate-500">Total kg picked across all pickers ÷ total picker-days worked ({analytics.totals.daysWorked}).</p>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-6 rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Berry types picked</h2>
                <p className="mt-1 text-sm text-slate-500">
                  How much of each berry type was picked, between which dates, and what rate was paid per kilogram.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBerryTypes}
                className="inline-flex items-center justify-center rounded-full bg-forest-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-800"
              >
                Download Excel
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {analytics.berryTypeBreakdown.map(berry => (
                <div key={berry.berryType} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-900">{berry.berryType}</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{berry.recordCount} entries</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Total picked: <span className="font-semibold text-forest-700">{formatKg(berry.totalKg)}</span>
                    {' '}· Paid out: <span className="font-semibold text-slate-800">{formatEuro(berry.totalPaid)}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Picked from {formatDateOnlyUtc(berry.firstPickedDate)} to {formatDateOnlyUtc(berry.lastPickedDate)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-forest-50 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Weighted avg</p>
                      <p className="mt-1 text-sm font-semibold text-forest-800">{formatEuro(berry.weightedAveragePricePerKg)}/kg</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Simple avg</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{formatEuro(berry.simpleAveragePricePerKg)}/kg</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Lowest</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{formatEuro(berry.minPricePerKg)}/kg</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Highest</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{formatEuro(berry.maxPricePerKg)}/kg</p>
                    </div>
                  </div>

                  {berry.priceRanges.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Rate by period</p>
                      <ul className="mt-2 space-y-1">
                        {berry.priceRanges.map((range, index) => (
                          <li key={index} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                            <span>{formatDateOnlyUtc(range.fromDate)} → {formatDateOnlyUtc(range.toDate)}</span>
                            <span className="font-semibold text-slate-900">{formatEuro(range.ratePerKg)}/kg</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
              {analytics.berryTypeBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500">No income records found in this period.</p>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl bg-forest-50 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total berries picked (all types)</p>
              <p className="mt-1 text-xl font-semibold text-forest-800">{formatKg(analytics.totalBerryPickedKg)}</p>
            </div>
            {analytics.nonWorkingRecordCount > 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                {analytics.nonWorkingRecordCount} record{analytics.nonWorkingRecordCount === 1 ? '' : 's'} marking a non-working day (0 kg picked)
                {' '}{analytics.nonWorkingRecordCount === 1 ? 'is' : 'are'} excluded from every figure above and from days-worked counts.
              </p>
            ) : null}
          </div>


          <div className="mt-6 rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Per-picker breakdown</h2>
                <p className="text-sm text-slate-500">Backing detail for every figure above, for audit and transparency.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{analytics.pickers.length}</span>
                <button
                  type="button"
                  onClick={handleExportPickers}
                  className="inline-flex items-center justify-center rounded-full bg-forest-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-800"
                >
                  Download Excel
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Picker</th>
                      <th className="px-4 py-3 font-semibold">Picker ID</th>
                      <th className="px-4 py-3 font-semibold">Group</th>
                      <th className="px-4 py-3 font-semibold">Days worked</th>
                      <th className="px-4 py-3 font-semibold">Kg picked</th>
                      <th className="px-4 py-3 font-semibold">Kg / day</th>
                      <th className="px-4 py-3 font-semibold">Gross</th>
                      <th className="px-4 py-3 font-semibold">Expense</th>
                      <th className="px-4 py-3 font-semibold">Fine</th>
                      <th className="px-4 py-3 font-semibold">Net</th>
                      <th className="px-4 py-3 font-semibold">Net / day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {analytics.pickers.map(picker => (
                      <tr key={picker.applicantId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-slate-700">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{picker.fullName}</p>
                            <p className="text-xs text-slate-500">{picker.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{picker.pickerId || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{picker.groupName || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{picker.daysWorked}</td>
                        <td className="px-4 py-3 text-slate-700">{formatKg(picker.kgPicked)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatKg(picker.kgPickedPerDay)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatEuro(picker.grossEarnings)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatEuro(picker.expenseTotal)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatEuro(picker.fineTotal)}</td>
                        <td className={`px-4 py-3 font-semibold ${picker.netEarnings < 0 ? 'text-rose-700' : 'text-forest-700'}`}>{formatEuro(picker.netEarnings)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatEuro(picker.netPerDay)}</td>
                      </tr>
                    ))}
                    {analytics.pickers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan="11">
                          No pickers have recorded income in this period.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {loading && !analytics ? <p className="mt-6 text-sm text-slate-600">Loading season analytics…</p> : null}

      <div className="mt-6 rounded-3xl border border-forest-100 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Berries picked per day</h2>
            <p className="mt-1 text-sm text-slate-500">
              Kg picked each day, broken down by berry type (e.g. Blueberry, Lingonberry) plus a combined total, across every picker.
              This has its own date filter, separate from the reporting period above, so you can check any window without changing the season-wide figures.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportDailyBerryPicked}
            disabled={!dailyData?.dailyBerryPicked?.length}
            className="inline-flex items-center justify-center rounded-full bg-forest-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Download Excel
          </button>
        </div>

        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleApplyDailyRange}>
          <label className="block text-sm font-medium text-slate-700">
            From date
            <input
              className="input mt-2"
              type="date"
              value={dailyRangeForm.fromDate}
              onChange={event => setDailyRangeForm(current => ({ ...current, fromDate: event.target.value }))}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            To date
            <input
              className="input mt-2"
              type="date"
              value={dailyRangeForm.toDate}
              onChange={event => setDailyRangeForm(current => ({ ...current, toDate: event.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={dailyLoading}
            className="rounded-full bg-forest-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {dailyLoading ? 'Loading…' : 'Apply range'}
          </button>
          <button
            type="button"
            onClick={handleResetDailyRange}
            disabled={dailyLoading}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Show all-time
          </button>
        </form>

        {dailyError ? <p className="mt-4 text-sm text-rose-600">{dailyError}</p> : null}

        {dailyData ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {dailyData.berryTypes.map(type => (
                <div key={type} className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total {type}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{formatKg(dailyData.totalsByType[type] || 0)}</p>
                </div>
              ))}
              <div className="rounded-2xl bg-forest-50 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">Grand total (all types)</p>
                <p className="mt-1 text-xl font-semibold text-forest-800">{formatKg(dailyData.totalKg)}</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Showing {formatDateOnlyUtc(dailyData.range.fromDate)} → {formatDateOnlyUtc(dailyData.range.toDate)}
            </p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      {dailyData.berryTypes.map(type => (
                        <th key={type} className="px-4 py-3 font-semibold">{type} (kg)</th>
                      ))}
                      <th className="px-4 py-3 font-semibold">Total kg picked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {dailyData.dailyBerryPicked.map(day => (
                      <tr key={day.date} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-slate-700">{formatDateOnlyUtc(day.date)}</td>
                        {dailyData.berryTypes.map(type => (
                          <td key={type} className="px-4 py-3 text-slate-700">{formatKg(day.byType[type] || 0)}</td>
                        ))}
                        <td className="px-4 py-3 font-semibold text-forest-700">{formatKg(day.totalKg)}</td>
                      </tr>
                    ))}
                    {dailyData.dailyBerryPicked.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={dailyData.berryTypes.length + 2}>
                          No picking days found in this period.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {dailyLoading && !dailyData ? <p className="mt-4 text-sm text-slate-600">Loading…</p> : null}
      </div>
    </section>
  );
}
