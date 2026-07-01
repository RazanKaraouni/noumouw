import { useContext } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import PageLoading from './components/layout/PageLoading.jsx';

import AdminLayout from './layouts/AdminLayout';
import TherapistLayout from './layouts/TherapistLayout';
import LoginPage from './pages/LoginPage';

import OverviewPage from './pages/admin/OverviewPage';
import UsersPage from './pages/admin/UsersPage';
import AutismScreeningArchivePage from './pages/admin/AutismScreeningArchivePage';
import MilestoneProgressArchivePage from './pages/admin/MilestoneProgressArchivePage';
import TherapistsPage from './pages/admin/TherapistsPage';
import MilestonesPage from './pages/admin/MilestonesPage';
import AutismQsPage from './pages/admin/AutismQsPage';

import GlobalActivityBank from './pages/admin/GlobalActivityBank';
import ContentModerator from './pages/admin/ContentModerator';
import ModerationQueuePage from './pages/admin/ModerationQueuePage';
import CommunityPostsPage from './pages/admin/CommunityPostsPage';
import AppointmentsOversightPage from './pages/admin/AppointmentsOversightPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import TipsModeration from './pages/admin/TipsModeration';
import ModerationLogPage from './pages/admin/ModerationLogPage';

import UploadResourcesPage from './pages/therapist/UploadResourcesPage';
import ChatPage from './pages/therapist/ChatPage';
import AvailabilityPage from './pages/therapist/AvailabilityPage';
import AppointmentsPage from './pages/therapist/AppointmentsPage';
import TherapistChildrenPage from './pages/therapist/TherapistChildrenPage';
import ChildProfilePage from './pages/therapist/ChildProfilePage';
import TherapistDashboardPage from './pages/therapist/TherapistDashboardPage';
import TherapistAssignmentsPage from './pages/therapist/TherapistAssignmentsPage';
import TherapistSettingsPage from './pages/therapist/TherapistSettingsPage';
import TherapistPaymentsPage from './pages/therapist/TherapistPaymentsPage';
import MyTips from './pages/MyTips.jsx';

function LegacyTherapistChildRedirect() {
  const { id } = useParams();
  return <Navigate to={`/therapist/children/${id}`} replace />;
}

export default function App() {
  const { user, role, loading } = useContext(AuthContext);

  if (loading) return <PageLoading />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (role !== 'admin' && role !== 'therapist') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      {role === 'admin' && (
        <Route element={<AdminLayout />}>
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route
            path="/reports"
            element={<Navigate to="/reports/autism-screening" replace />}
          />
          <Route path="/reports/autism-screening" element={<AutismScreeningArchivePage />} />
          <Route path="/reports/milestones-progress" element={<MilestoneProgressArchivePage />} />
          <Route path="/therapists" element={<TherapistsPage />} />
          <Route path="/appointments" element={<AppointmentsOversightPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/content-moderation" element={<ContentModerator />} />
          <Route path="/moderation-queue" element={<ModerationQueuePage />} />
          <Route path="/tips-moderation" element={<TipsModeration />} />
          <Route path="/moderation-log" element={<ModerationLogPage />} />
          <Route path="/community-posts" element={<CommunityPostsPage />} />
          <Route path="/settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="/overview" />} />
        </Route>
      )}
      {role === 'therapist' && (
        <>
          <Route path="/dashboard" element={<Navigate to="/therapist/dashboard" replace />} />
          <Route path="/chat" element={<Navigate to="/therapist/chat" replace />} />
          <Route path="/availability" element={<Navigate to="/therapist/availability" replace />} />
          <Route path="/appointments" element={<Navigate to="/therapist/appointments" replace />} />
          <Route path="/payments" element={<Navigate to="/therapist/payments" replace />} />
          <Route path="/children" element={<Navigate to="/therapist/children" replace />} />
          <Route path="/children/:id" element={<LegacyTherapistChildRedirect />} />
          <Route path="/assignments" element={<Navigate to="/therapist/assignments" replace />} />
          <Route path="/settings" element={<Navigate to="/therapist/settings" replace />} />
          <Route path="/milestones" element={<Navigate to="/therapist/milestones" replace />} />
          <Route path="/activity-bank" element={<Navigate to="/therapist/activity-bank" replace />} />
          <Route path="/activities" element={<Navigate to="/therapist/activity-bank" replace />} />
          <Route path="/autism-qs" element={<Navigate to="/therapist/autism-qs" replace />} />
          <Route path="/uploads" element={<Navigate to="/therapist/uploads" replace />} />
          <Route path="/uploads/*" element={<Navigate to="/therapist/uploads" replace />} />
          <Route path="/my-tips" element={<Navigate to="/therapist/my-tips" replace />} />
          <Route path="/therapist" element={<TherapistLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TherapistDashboardPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="payments" element={<TherapistPaymentsPage />} />
            <Route path="children" element={<TherapistChildrenPage />} />
            <Route path="children/:id" element={<ChildProfilePage />} />
            <Route path="assignments" element={<TherapistAssignmentsPage />} />
            <Route path="settings" element={<TherapistSettingsPage />} />
            <Route path="milestones" element={<MilestonesPage />} />
            <Route path="activity-bank" element={<GlobalActivityBank />} />
            <Route path="autism-qs" element={<AutismQsPage />} />
            <Route path="activities" element={<Navigate to="/therapist/activity-bank" replace />} />
            <Route path="uploads" element={<UploadResourcesPage />} />
            <Route path="uploads/articles" element={<Navigate to="/therapist/uploads" replace />} />
            <Route path="uploads/video" element={<Navigate to="/therapist/uploads" replace />} />
            <Route path="uploads/image" element={<Navigate to="/therapist/uploads" replace />} />
            <Route path="uploads/media" element={<Navigate to="/therapist/uploads" replace />} />
            <Route path="my-tips" element={<MyTips />} />
          </Route>
          <Route path="*" element={<Navigate to="/therapist/dashboard" replace />} />
        </>
      )}
    </Routes>
  );
}

