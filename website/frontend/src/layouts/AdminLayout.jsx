import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/admin/Sidebar';
import DashboardShell from '../components/layout/DashboardShell.jsx';
import { CardGridSkeleton } from '../components/admin/ui';

export default function AdminLayout() {
  const { user, admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="dashboard-shell">
        <main className="dashboard-main dashboard-main--bare">
          <div className="dashboard-main__content">
            <CardGridSkeleton count={6} />
          </div>
        </main>
      </div>
    );
  }

  if (!user || !admin) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <DashboardShell sidebar={<Sidebar />}>
      <Outlet />
    </DashboardShell>
  );
}
