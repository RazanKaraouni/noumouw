import { SignedChildProfileImage } from '../../components/SignedChildProfileImage.jsx';
import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { therapistApi } from '../../lib/therapistApi';
import ActivityLibraryAssignModal from '../../components/therapist/ActivityLibraryAssignModal';
import {
  PageHeader,
  GlassCard,
  Skeleton,
  EmptyState,
  Badge,
  Btn,
  riskBadgeTone,
  formatDate,
} from '../../components/therapist/ui/TherapistUI';

function taskBadge(activeTasks) {
  const n = Number(activeTasks) || 0;
  if (n > 0) return { label: `🟢 ${n} Pending Task${n === 1 ? '' : 's'}`, tone: 'warning' };
  return { label: '✅ All Tasks Completed', tone: 'success' };
}

export default function TherapistChildrenPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [assignTarget, setAssignTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await therapistApi.children.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getUserFacingError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const messageParent = async (row) => {
    if (!row.parent_user_id) {
      setError('Parent chat is not available for this child yet.');
      return;
    }
    try {
      const room = await therapistApi.chat.ensureRoom(row.parent_user_id);
      navigate('/therapist/chat', { state: { roomId: room.chat_room_id } });
    } catch (e) {
      setError(getUserFacingError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Children"
        subtitle="Children appear here after you confirm their appointment. Open a profile to review files and assign activities before the first session."
        action={
          <Btn variant="ghost" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            Refresh
          </Btn>
        }
      />

      {error && <div className="td-alert td-alert-error" role="alert">{error}</div>}

      {loading && (
        <div className="td-grid-children">
          {[1, 2, 3].map((i) => (
            <GlassCard key={i}>
              <Skeleton style={{ height: 56, width: 56, marginBottom: 12 }} />
              <Skeleton style={{ height: 18, width: '70%', marginBottom: 8 }} />
              <Skeleton style={{ height: 12, width: '50%' }} />
            </GlassCard>
          ))}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon="👶"
          title="No children yet"
          description="When a parent books, confirm the appointment and the child will appear here so you can review their profile before the first session."
          action={
            <Btn variant="accent" onClick={() => navigate('/therapist/appointments')} style={{ marginTop: 16 }}>
              View appointments
            </Btn>
          }
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="td-grid-children">
          {rows.map((r) => {
            const childId = r.children_id ?? r.child_id;
            const tasks = taskBadge(r.active_tasks);
            return (
              <GlassCard key={r.id || `${childId}-${r.parent_id}`} className="td-fade-in">
                <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                  {r.profile_image_url ? (
                    <SignedChildProfileImage
                      src={r.profile_image_url}
                      alt=""
                      className="td-child-card-avatar"
                      onExpired={() => setRefreshKey((k) => k + 1)}
                    />
                  ) : (
                    <div className="td-child-card-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--muted)' }}>
                      ○
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{r.full_name}</span>
                      <Badge tone={tasks.tone}>{tasks.label}</Badge>
                    </div>
                    <div className="td-meta">
                      {r.age_label} · {r.gender || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted)' }}>Parent </span>
                  {r.parent_name}
                </div>
                <div style={{ fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--muted)' }}>Screening </span>
                  <Badge tone={riskBadgeTone(r.risk_level || r.screening_risk_level)}>
                    {r.risk_level || r.screening_risk_level || '—'}
                  </Badge>
                </div>
                <div style={{ fontSize: 13, marginBottom: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>Last session </span>
                  {formatDate(r.last_session_date || r.latest_session_date)}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Btn variant="accent" onClick={() => navigate(`/therapist/children/${childId}`)}>
                    View profile
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() =>
                      setAssignTarget({
                        childId: Number(childId),
                        childName: r.full_name,
                        childAgeMonths: r.age_months,
                        childDateOfBirth: r.date_of_birth,
                      })
                    }
                  >
                    Assign task
                  </Btn>
                  <Btn variant="ghost" onClick={() => messageParent(r)}>
                    Message parent
                  </Btn>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <ActivityLibraryAssignModal
        open={Boolean(assignTarget)}
        childId={assignTarget?.childId}
        childName={assignTarget?.childName}
        childAgeMonths={assignTarget?.childAgeMonths}
        childDateOfBirth={assignTarget?.childDateOfBirth}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

