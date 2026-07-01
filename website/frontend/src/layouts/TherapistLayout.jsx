import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChatUnreadProvider, useChatUnread } from '../context/ChatUnreadContext';
import TherapistSidebar from '../components/therapist/TherapistSidebar';
import NotificationBell from '../components/therapist/NotificationBell';
import ChatUnreadBadge from '../components/therapist/ChatUnreadBadge';
import DashboardShell from '../components/layout/DashboardShell.jsx';
import PageLoading from '../components/layout/PageLoading.jsx';

function TherapistLayoutContent() {
  const navigate = useNavigate();
  const { totalUnread } = useChatUnread();

  return (
    <DashboardShell
      sidebar={<TherapistSidebar />}
      topBar={<NotificationBell />}
      contentClassName="dashboard-main__content--therapist"
    >
      <Outlet />
      <button
        type="button"
        className="td-chat-fab-btn"
        onClick={() => navigate('/therapist/chat')}
        title="Open chat inbox"
        aria-label={`Open chat inbox${totalUnread ? `, ${totalUnread} unread` : ''}`}
      >
        💬
        <ChatUnreadBadge count={totalUnread} />
      </button>
    </DashboardShell>
  );
}

export default function TherapistLayout() {
  const { therapist, loading } = useAuth();

  if (loading) return <PageLoading />;
  if (!therapist) return <Navigate to="/login" replace />;

  return (
    <ChatUnreadProvider>
      <TherapistLayoutContent />
    </ChatUnreadProvider>
  );
}
