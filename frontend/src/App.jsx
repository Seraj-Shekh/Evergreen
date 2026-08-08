import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import ApplicationPage from './pages/ApplicationPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import SuccessPage from './pages/SuccessPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AdminIncomePage from './pages/AdminIncomePage.jsx';
import AdminIncomeRecordPage from './pages/AdminIncomeRecordPage.jsx';
import AdminFinePage from './pages/AdminFinePage.jsx';
import AdminExpensePage from './pages/AdminExpensePage.jsx';
import AdminPaymentRecordPage from './pages/AdminPaymentRecordPage.jsx';
import AdminTopPickersPage from './pages/AdminTopPickersPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import UserPortalPage from './pages/UserPortalPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/apply" element={<ApplicationPage />} />
        <Route path="/privacy-policy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/income" element={<AdminIncomePage />} />
        <Route path="/admin/income-record" element={<AdminIncomeRecordPage />} />
        <Route path="/admin/fines" element={<AdminFinePage />} />
        <Route path="/admin/expenses" element={<AdminExpensePage />} />
        <Route path="/admin/payment-record" element={<AdminPaymentRecordPage />} />
        <Route path="/admin/top-pickers" element={<AdminTopPickersPage />} />
        <Route path="/portal" element={<UserPortalPage />} />
        <Route path="/portal/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/portal/reset-password" element={<ResetPasswordPage />} />
        <Route path="/portal/:section" element={<UserPortalPage />} />
        <Route path="/success" element={<SuccessPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
