import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useState } from 'react';
import { therapistModel } from '../../models/therapistModel.js';

/** Controller: child picker step for Add Task flow. */
export function useAddTaskAssignFlow(open) {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [childId, setChildId] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await therapistModel.children.list();
      setChildren(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getUserFacingError(e));
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setChildId('');
    setAssignOpen(false);
    setError('');
    loadChildren();
  }, [open, loadChildren]);

  const selected = children.find((c) => String(c.children_id ?? c.child_id) === childId);
  const selectedId = selected ? Number(selected.children_id ?? selected.child_id) : NaN;

  const continueToAssign = () => {
    if (!Number.isFinite(selectedId)) {
      setError('Select a child to continue.');
      return false;
    }
    setError('');
    setAssignOpen(true);
    return true;
  };

  const closeAssignStep = () => setAssignOpen(false);

  return {
    children,
    loading,
    error,
    setError,
    childId,
    setChildId,
    assignOpen,
    selected,
    selectedId,
    selectedName: selected?.full_name || '',
    childAgeMonths: selected?.age_months,
    childDateOfBirth: selected?.date_of_birth,
    continueToAssign,
    closeAssignStep,
    setAssignOpen,
  };
}
