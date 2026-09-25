import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

import LoginPage from '../features/auth/LoginPage.jsx';
import RegisterPage from '../features/auth/RegisterPage.jsx';
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../features/auth/ResetPasswordPage.jsx';

import DashboardPage from '../features/dashboard/DashboardPage.jsx';
import FollowUpsPage from '../features/followups/FollowUpsPage.jsx';






import LeadsPage from '../features/leads/LeadsPage.jsx';
import PropertiesPage from '../features/properties/PropertiesPage.jsx';
import WhatsAppPage from '../features/whatsapp/WhatsAppPage.jsx';
import ConversationsPage from '../features/conversations/ConversationsPage.jsx';
import AnalyticsPage from '../features/analytics/AnalyticsPage.jsx';
import SiteVisitsPage from '../features/meetings/SiteVisitsPage.jsx';
import SettingsPage from '../features/settings/SettingsPage.jsx';
import ProfilePage from '../features/profile/ProfilePage.jsx';





import { authApi } from '../api/authApi.js';
import { useAuthStore } from '../store/authStore.js';

export default function AppRouter() {
  const { setSession, markAuthReady } = useAuthStore();

  useEffect(() => {
    // Silent refresh on load: if a valid refresh cookie exists, restore the session.
    (async () => {
      try {
        const { data } = await authApi.refresh();
        const me = await authApi.me();
        useAuthStore.getState().setAccessToken(data.accessToken);
        setSession(me.data.user, data.accessToken);
      } catch (err) {
        markAuthReady();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {/* <Route path="/dashboard" element={<DashboardPage />} /> */}
          <Route path="/dashboard" element={<AnalyticsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          {/* <Route path="/analytics" element={<AnalyticsPage />} /> */}
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/site-visits" element={<SiteVisitsPage />} />


          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
