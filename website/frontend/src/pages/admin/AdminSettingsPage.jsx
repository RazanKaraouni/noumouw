import { useAuth } from '../../context/AuthContext';
import AdminPageHeader from '../../components/admin/ui/AdminPageHeader.jsx';
import ThemeSettingRow from '../../components/layout/ThemeSettingRow.jsx';

export default function AdminSettingsPage() {
  const { admin } = useAuth();
  const name =
    admin?.full_name ||
    `${admin?.firstName || ''} ${admin?.lastName || ''}`.trim() ||
    'Admin';

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Manage your admin account and appearance preferences."
      />

      <div style={{ marginBottom: 24 }}>
        <div className="dashboard-section-label">Account</div>
        <div className="dashboard-panel">
          <p style={{ fontSize: 14, marginBottom: 10 }}>
            <span style={{ color: 'var(--muted)' }}>Name </span>
            {name}
          </p>
          <p style={{ fontSize: 14 }}>
            <span style={{ color: 'var(--muted)' }}>Email </span>
            {admin?.email || '—'}
          </p>
        </div>
      </div>

      <div>
        <div className="dashboard-section-label">Appearance</div>
        <div className="dashboard-panel">
          <ThemeSettingRow />
        </div>
      </div>
    </div>
  );
}
