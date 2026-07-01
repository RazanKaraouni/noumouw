import { SignedChildProfileImage } from '../../components/SignedChildProfileImage.jsx';
import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { therapistApi } from '../../lib/therapistApi';
import AssignmentFormModal from '../../components/therapist/AssignmentFormModal';
import ActivityLibraryAssignModal from '../../components/therapist/ActivityLibraryAssignModal';
import ScreeningResponsesPanel from '../../components/therapist/ScreeningResponsesPanel';
import {
  PageHeader,
  GlassCard,
  Section,
  Skeleton,
  Badge,
  Btn,
  Modal,
  riskBadgeTone,
  formatDate,
} from '../../components/therapist/ui/TherapistUI';

function milestoneProgress(milestones) {
  const total = milestones.length;
  const done = milestones.filter((m) => m.is_completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

export default function ChildProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const childId = Number(id);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignOpen, setAssignOpen] = useState(Boolean(location.state?.openAssign));
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [replyDraft, setReplyDraft] = useState({});
  const [editAssign, setEditAssign] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!Number.isFinite(childId)) {
      setError('Invalid child id.');
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await therapistApi.children.profile(childId);
      setProfile(data);
      if (!silent) setError('');
    } catch (e) {
      if (!silent) setError(getUserFacingError(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [load]);

  const refresh = () => load();

  const onActivityAssigned = async () => {
    await refresh();
  };

  const updateAssignment = async (assignmentId, patch) => {
    await therapistApi.assignments.update(assignmentId, patch);
    await refresh();
  };

  const deleteAssignment = async (assignmentId) => {
    if (!window.confirm('Delete this assignment?')) return;
    await therapistApi.assignments.delete(assignmentId);
    await refresh();
  };

  const saveNote = async () => {
    if (!noteText.trim()) return;
    await therapistApi.children.createNote(childId, { note: noteText.trim() });
    setNoteText('');
    setNoteOpen(false);
    await refresh();
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    await therapistApi.notes.delete(noteId);
    await refresh();
  };

  if (loading) {
    return (
      <div>
        <Skeleton style={{ height: 32, width: 240, marginBottom: 20 }} />
        <div className="td-profile-grid">
          <Skeleton style={{ height: 200 }} />
          <Skeleton style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div>
        <div className="td-alert td-alert-error">{error || 'Profile not found.'}</div>
        <Btn variant="ghost" onClick={() => navigate('/therapist/children')} style={{ marginTop: 12 }}>
          ← Back to children
        </Btn>
      </div>
    );
  }

  const {
    child,
    parent,
    milestones,
    screening_results,
    assignments,
    appointments,
    therapist_private_notes,
    reports,
    access_mode,
    is_first_session,
    appointment_context,
  } = profile;
  const preSession = access_mode === 'appointment' || location.state?.preSession;
  const mp = milestoneProgress(milestones || []);
  const latestScreen = (screening_results || [])[0];
  const screeningReports = (reports || []).filter((r) => r.report_type === 'screening_summary');
  const milestoneReports = (reports || []).filter((r) => r.report_type === 'milestone_tracking');
  const pendingMilestones = (milestones || []).filter((m) => !m.is_completed);
  const completedMilestones = (milestones || []).filter((m) => m.is_completed);

  const categories = [...new Set((milestones || []).map((m) => m.milestone_category).filter(Boolean))];

  return (
    <div>
      <Link to="/therapist/children" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
        ← Children
      </Link>

      <PageHeader
        title={child.full_name || 'Child profile'}
        subtitle={
          preSession
            ? `Pre-session review${appointment_context?.appointment_date ? ` · session ${formatDate(appointment_context.appointment_date)}` : ''}`
            : profile.link?.assigned_at
              ? `Linked since ${formatDate(profile.link.assigned_at)}`
              : 'Child profile'
        }
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {is_first_session && <Badge tone="warning">First session</Badge>}
            {preSession && <Badge tone="info">Pre-session</Badge>}
            <Btn variant="primary" onClick={() => setAssignOpen(true)}>
              + Add assignment
            </Btn>
          </div>
        }
      />

      <div className="td-profile-grid">
        <Section title="Child information">
          <GlassCard>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {child.profile_image_url ? (
                <SignedChildProfileImage
                  src={child.profile_image_url}
                  alt=""
                  className="td-child-card-avatar"
                  style={{ width: 72, height: 72 }}
                  onExpired={refresh}
                />
              ) : (
                <div className="td-child-card-avatar" style={{ width: 72, height: 72 }} />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{child.full_name}</div>
                <div className="td-meta" style={{ marginTop: 4 }}>
                  {child.gender || '—'} · DOB {formatDate(child.date_of_birth)}
                </div>
                <div style={{ marginTop: 8 }}><Badge tone="info">🔵 In Therapy</Badge></div>
              </div>
            </div>
            <p style={{ fontSize: 13 }}><strong style={{ color: 'var(--muted)' }}>Notes</strong> · {child.notes || '—'}</p>
          </GlassCard>
        </Section>

        <Section title="Parent information">
          <GlassCard>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{parent?.full_name || '—'}</p>
            <p style={{ fontSize: 13, marginBottom: 6 }}>📞 {parent?.phone || '—'}</p>
            <p style={{ fontSize: 13, marginBottom: 6 }}>✉ {parent?.email || '—'}</p>
            <p style={{ fontSize: 13 }}>📍 {parent?.address || '—'}</p>
          </GlassCard>
        </Section>
      </div>

      <Section title="Milestone tracking">
        <GlassCard>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span>{mp.done} / {mp.total} completed</span>
              <span>{mp.pct}%</span>
            </div>
            <div className="td-progress-bar">
              <div className="td-progress-fill" style={{ width: `${mp.pct}%` }} />
            </div>
          </div>
          {categories.map((cat) => {
            const inCat = (milestones || []).filter((m) => m.milestone_category === cat);
            const done = inCat.filter((m) => m.is_completed).length;
            const catPct = inCat.length ? Math.round((done / inCat.length) * 100) : 0;
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{cat} ({done}/{inCat.length})</div>
                <div className="td-progress-bar">
                  <div className="td-progress-fill" style={{ width: `${catPct}%`, opacity: 0.85 }} />
                </div>
              </div>
            );
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--accent)' }}>Completed</h4>
              {completedMilestones.length === 0 ? <p className="td-meta">None yet</p> : completedMilestones.map((m) => (
                <div key={m.child_milestones_id ?? m.milestones_id} style={{ fontSize: 12, marginBottom: 6 }}>✓ {m.milestone_title}</div>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: 13, marginBottom: 8, color: '#facc15' }}>Pending</h4>
              {pendingMilestones.length === 0 ? <p className="td-meta">All done</p> : pendingMilestones.map((m) => (
                <div key={m.child_milestones_id ?? m.milestones_id} style={{ fontSize: 12, marginBottom: 6 }}>○ {m.milestone_title}</div>
              ))}
            </div>
          </div>
        </GlassCard>
      </Section>

      <Section title="Autism screening">
        <GlassCard>
          <ScreeningResponsesPanel screening={latestScreen} />
        </GlassCard>
      </Section>

      <Section title="Saved reports & files">
        <GlassCard>
          {screeningReports.length === 0 && milestoneReports.length === 0 ? (
            <p className="td-meta">No saved reports yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {screeningReports.map((r) => (
                <div key={r.reports_id} style={{ fontSize: 13, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <strong>Screening summary</strong>
                  <span className="td-meta" style={{ marginLeft: 8 }}>{formatDate(r.created_at)}</span>
                  {r.title && <div className="td-meta">{r.title}</div>}
                  {r.data_payload?.risk_level && (
                    <div style={{ marginTop: 6 }}>
                      <Badge tone={riskBadgeTone(r.data_payload.risk_level)}>{r.data_payload.risk_level}</Badge>
                      {r.data_payload?.total_score != null && (
                        <span className="td-meta" style={{ marginLeft: 8 }}>Score {r.data_payload.total_score}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {milestoneReports.map((r) => (
                <div key={r.reports_id} style={{ fontSize: 13 }}>
                  <strong>Milestone progress report</strong>
                  <span className="td-meta" style={{ marginLeft: 8 }}>{formatDate(r.created_at)}</span>
                  {r.title && <div className="td-meta">{r.title}</div>}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </Section>

      <Section
        title="Assignments"
        action={<Btn variant="accent" onClick={() => setAssignOpen(true)}>+ Add assignment</Btn>}
      >
        {(assignments || []).length === 0 ? (
          <GlassCard className="td-empty">
            <p className="td-empty-desc">No assignments added yet</p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(assignments || []).map((a) => (
              <GlassCard key={a.assignment_id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <strong>{a.title}</strong>
                  <Badge tone={a.status === 'completed' ? 'success' : 'warning'}>{a.status}</Badge>
                </div>
                <p className="td-meta" style={{ marginBottom: 8 }}>
                  {a.domain} · {a.priority || 'medium'} · Due {formatDate(a.due_date)} · Created {formatDate(a.created_at)}
                </p>
                {a.description && <p style={{ fontSize: 13, marginBottom: 10 }}>{a.description}</p>}
                {a.parent_notes && (
                  <div style={{ background: 'var(--surface2)', padding: 10, borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                    <strong>Parent feedback:</strong> {a.parent_notes}
                  </div>
                )}
                <div className="td-field">
                  <label className="td-label">Therapist reply</label>
                  <textarea
                    className="td-textarea"
                    rows={2}
                    value={replyDraft[a.assignment_id] ?? a.therapist_reply ?? ''}
                    onChange={(e) => setReplyDraft((d) => ({ ...d, [a.assignment_id]: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <Btn
                    variant="ghost"
                    onClick={() =>
                      updateAssignment(a.assignment_id, {
                        therapist_reply: (replyDraft[a.assignment_id] ?? a.therapist_reply ?? '').trim() || null,
                      })
                    }
                  >
                    Save reply
                  </Btn>
                  {a.status !== 'completed' && (
                    <Btn variant="accent" onClick={() => updateAssignment(a.assignment_id, { status: 'completed' })}>
                      Mark completed
                    </Btn>
                  )}
                  <Btn variant="ghost" onClick={() => setEditAssign(a)}>Edit</Btn>
                  <Btn variant="danger" onClick={() => deleteAssignment(a.assignment_id)}>Delete</Btn>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </Section>

      <Section title="Appointment history">
        <GlassCard style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Date</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(appointments || []).map((ap) => (
                <tr key={ap.appointments_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px' }}>{formatDate(ap.appointment_date)}</td>
                  <td style={{ padding: '10px' }}><Badge>{ap.status}</Badge></td>
                  <td style={{ padding: '10px', color: 'var(--muted)' }}>{ap.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(appointments || []).length === 0 && <p className="td-meta" style={{ padding: 12 }}>No appointments yet.</p>}
        </GlassCard>
      </Section>

      <Section
        title="Therapist notes"
        action={<Btn variant="accent" onClick={() => setNoteOpen(true)}>+ Add note</Btn>}
      >
        {(therapist_private_notes || []).length === 0 ? (
          <GlassCard><p className="td-meta">No private notes yet.</p></GlassCard>
        ) : (
          (therapist_private_notes || []).map((n) => (
            <GlassCard key={n.therapist_private_note_id} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 13, marginBottom: 8 }}>{n.note}</p>
              <div className="td-meta" style={{ marginBottom: 8 }}>{formatDate(n.updated_at || n.created_at)}</div>
              <Btn variant="danger" onClick={() => deleteNote(n.therapist_private_note_id)}>Delete</Btn>
            </GlassCard>
          ))
        )}
      </Section>

      <ActivityLibraryAssignModal
        open={assignOpen}
        childId={childId}
        childName={child?.full_name}
        childAgeMonths={child?.age_months}
        childDateOfBirth={child?.date_of_birth}
        onClose={() => setAssignOpen(false)}
        onAssigned={onActivityAssigned}
      />
      <AssignmentFormModal
        open={Boolean(editAssign)}
        onClose={() => setEditAssign(null)}
        modalTitle="Edit assignment"
        initial={
          editAssign
            ? {
                title: editAssign.title,
                description: editAssign.description || '',
                domain: editAssign.domain,
                priority: editAssign.priority || 'medium',
                due_date: editAssign.due_date ? String(editAssign.due_date).slice(0, 10) : '',
              }
            : undefined
        }
        onSubmit={async (body) => {
          await updateAssignment(editAssign.assignment_id, body);
          setEditAssign(null);
        }}
      />

      <Modal
        open={noteOpen}
        title="Add private note"
        onClose={() => setNoteOpen(false)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveNote}>Save</Btn>
          </>
        }
      >
        <textarea className="td-textarea" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Session observations…" />
      </Modal>
    </div>
  );
}


