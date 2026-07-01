import ActivityLibraryAssignModal from './ActivityLibraryAssignModal';
import { Modal, Btn } from './ui/TherapistUI';
import { useAddTaskAssignFlow } from '../../controllers/therapist/useAddTaskAssignFlow';

export default function AddTaskAssignFlow({ open, onClose, onComplete }) {
  const {
    children,
    loading,
    error,
    childId,
    setChildId,
    assignOpen,
    selectedId,
    selectedName,
    childAgeMonths,
    childDateOfBirth,
    continueToAssign,
    closeAssignStep,
  } = useAddTaskAssignFlow(open);

  const handleClose = () => {
    closeAssignStep();
    onClose?.();
  };

  const handleContinue = () => {
    continueToAssign();
  };

  const handleAssigned = () => {
    closeAssignStep();
    onComplete?.();
  };

  return (
    <>
      <Modal
        open={open && !assignOpen}
        title="Add task"
        onClose={handleClose}
        footer={
          <>
            <Btn variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={handleContinue}
              disabled={loading || children.length === 0 || !childId}
            >
              Continue
            </Btn>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          Choose a child, then pick an activity from your library to assign as a task.
        </p>

        {error && <div className="td-alert td-alert-error">{error}</div>}

        {loading && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading children…</p>
        )}

        {!loading && children.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            No children in your caseload yet. Complete a first session to link a child.
          </p>
        )}

        {!loading && children.length > 0 && (
          <div className="td-field">
            <label className="td-label" htmlFor="add-task-child">
              Child
            </label>
            <select
              id="add-task-child"
              className="td-select"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
            >
              <option value="">Select a child…</option>
              {children.map((c) => {
                const id = c.children_id ?? c.child_id;
                return (
                  <option key={id} value={String(id)}>
                    {c.full_name}
                    {c.parent_name ? ` · ${c.parent_name}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </Modal>

      <ActivityLibraryAssignModal
        open={open && assignOpen}
        childId={selectedId}
        childName={selectedName}
        childAgeMonths={childAgeMonths}
        childDateOfBirth={childDateOfBirth}
        onClose={closeAssignStep}
        onAssigned={handleAssigned}
      />
    </>
  );
}
