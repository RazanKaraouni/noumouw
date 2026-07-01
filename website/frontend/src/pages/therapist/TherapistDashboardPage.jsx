import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTherapistDashboard } from '../../controllers/therapist/useTherapistDashboard';
import DashboardMeetingsPanel from '../../components/therapist/DashboardMeetingsPanel.jsx';
import { PageHeader, Btn } from '../../components/therapist/ui/TherapistUI';

function safeFirstName(therapist) {
  const raw = therapist?.full_name || therapist?.firstName || '';
  const first = String(raw).trim().split(' ')[0];
  return first || 'Therapist';
}

const STAT_ITEMS = [
  { key: 'linkedChildren', label: 'Linked children', accent: 'indigo', icon: '👥' },
  { key: 'pendingAppointments', label: 'Pending appointments', accent: 'amber', icon: '🕐' },
  { key: 'openSlots', label: 'Open availability slots', accent: 'green', icon: '📅' },
  { key: 'pendingAssignments', label: 'Pending assignments', accent: 'amber', icon: '📝' },
  { key: 'completedSessions', label: 'Completed sessions', accent: 'blue', icon: '📋' },
];

function StatCard({ value, label, loading, accent, icon }) {
  return (
    <article className={`td-stat-card td-stat-card--${accent}`}>
      <div className="td-stat-icon" aria-hidden>
        {icon}
      </div>
      <p className="td-stat-value">{loading ? '—' : value}</p>
      <p className="td-stat-label">{label}</p>
    </article>
  );
}

/** View: therapist dashboard stats and upcoming meetings. */
export default function TherapistDashboardPage() {
  const { therapist } = useAuth();
  const { stats, loading, error, refresh } = useTherapistDashboard();
  const [meetingsRefreshKey, setMeetingsRefreshKey] = useState(0);

  const handleRefresh = () => {
    refresh();
    setMeetingsRefreshKey((k) => k + 1);
  };

  return (
    <div className="td-fade-in">
      <PageHeader
        title={`Hello, ${safeFirstName(therapist)} 👋`}
        subtitle="Overview of your practice — appointments, caseload, and tasks."
        action={
          <Btn variant="ghost" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Btn>
        }
      />

      {error && (
        <div className="td-alert td-alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="td-dashboard-layout">
        <section className="td-dashboard-stats">
          <div className="td-stat-grid td-stat-grid--compact">
            {STAT_ITEMS.map(({ key, label, accent, icon }) => (
              <StatCard
                key={key}
                value={stats[key]}
                label={label}
                loading={loading}
                accent={accent}
                icon={icon}
              />
            ))}
          </div>
        </section>

        <DashboardMeetingsPanel refreshKey={meetingsRefreshKey} />
      </div>
    </div>
  );
}
