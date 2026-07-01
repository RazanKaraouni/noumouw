import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AddTaskAssignFlow from '../../components/therapist/AddTaskAssignFlow';
import { PageHeader, GlassCard, Skeleton, EmptyState, Badge, Btn, formatDate } from '../../components/therapist/ui/TherapistUI';
import { useTherapistAssignments } from '../../controllers/therapist/useTherapistAssignments';

/** View: assignments list (controller handles Model I/O). */
export default function TherapistAssignmentsPage() {
  const navigate = useNavigate();
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const {
    rows,
    loading,
    error,
    load,
    replyDraft,
    setReplyDraft,
    savingReplyId,
    saveReply,
    needsReply,
  } = useTherapistAssignments();

  return (
    <div>
      <PageHeader
        title="Assignments"
        subtitle="Tasks you have assigned — read parent notes and reply from here or on each child's profile."
        action={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Btn variant="accent" onClick={() => setAddTaskOpen(true)}>
              Add task
            </Btn>
            <Btn variant="ghost" onClick={load} disabled={loading}>
              Refresh
            </Btn>
          </div>
        }
      />
      {error && <div className="td-alert td-alert-error">{error}</div>}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton style={{ height: 72 }} />
          <Skeleton style={{ height: 72 }} />
        </div>
      )}
      {!loading && rows.length === 0 && (
        <EmptyState
          title="No assignments added yet"
          description="Choose a child and assign an activity from your library."
          action={
            <Btn variant="accent" style={{ marginTop: 16 }} onClick={() => setAddTaskOpen(true)}>
              Add task
            </Btn>
          }
        />
      )}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((a) => (
            <GlassCard key={a.assignment_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{a.title}</div>
                  <Link to={`/therapist/children/${a.child_id}`} style={{ fontSize: 13, color: 'var(--accent)' }}>
                    {a.child_name}
                  </Link>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {needsReply(a) && <Badge tone="warning">Parent note</Badge>}
                  <Badge tone={a.status === 'completed' ? 'success' : 'warning'}>{a.status}</Badge>
                </div>
              </div>
              <p className="td-meta" style={{ marginTop: 8 }}>
                {a.domain} · {a.priority || 'medium'} · Due {formatDate(a.due_date)}
              </p>
              {a.description && (
                <p style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>{a.description}</p>
              )}
              {a.parent_notes?.trim() && (
                <div
                  style={{
                    background: 'var(--surface2)',
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 12,
                    fontSize: 13,
                    borderLeft: '3px solid var(--accent)',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: 4 }}>Parent note</strong>
                  {a.parent_notes}
                </div>
              )}
              <div className="td-field" style={{ marginTop: 12 }}>
                <label className="td-label" htmlFor={`reply-${a.assignment_id}`}>
                  Your reply
                </label>
                <textarea
                  id={`reply-${a.assignment_id}`}
                  className="td-textarea"
                  rows={2}
                  placeholder={a.parent_notes ? 'Reply to the parent…' : 'Optional message to the parent'}
                  value={replyDraft[a.assignment_id] ?? a.therapist_reply ?? ''}
                  onChange={(e) =>
                    setReplyDraft((d) => ({ ...d, [a.assignment_id]: e.target.value }))
                  }
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                <Btn
                  variant="primary"
                  disabled={savingReplyId === a.assignment_id}
                  onClick={() => saveReply(a.assignment_id, a.therapist_reply)}
                >
                  {savingReplyId === a.assignment_id ? 'Saving…' : 'Save reply'}
                </Btn>
                <Btn variant="ghost" onClick={() => navigate(`/therapist/children/${a.child_id}`)}>
                  Open child profile
                </Btn>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <AddTaskAssignFlow
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onComplete={() => {
          setAddTaskOpen(false);
          load();
        }}
      />
    </div>
  );
}
