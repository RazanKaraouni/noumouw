import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { therapistModel } from '../../models/therapistModel.js';
import { buildAssignmentFromActivity, activityAgeLabel } from '../../models/activityModel.js';
import { filterActivitiesByChildAge } from '../../utils/activityAgeFilter.js';
import { dedupeActivitiesByTitle } from '../../utils/dedupeActivities.js';
import { resolveChildAgeMonths } from '../../utils/childAge.js';

/** Controller: activity library picker + assign action. */
export function useActivityLibraryAssign({
  open,
  childId,
  childAgeMonths,
  childDateOfBirth,
  onAssigned,
  onClose,
}) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resolvedChildAgeMonths = useMemo(
    () => resolveChildAgeMonths(childDateOfBirth, childAgeMonths),
    [childDateOfBirth, childAgeMonths],
  );

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (domainFilter) params.domain = domainFilter;
      if (Number.isFinite(resolvedChildAgeMonths)) {
        params.child_age_months = resolvedChildAgeMonths;
      }
      const data = await therapistModel.activities.list(params);
      const rows = Array.isArray(data) ? data : [];
      const ageFiltered = filterActivitiesByChildAge(rows, resolvedChildAgeMonths);
      setActivities(dedupeActivitiesByTitle(ageFiltered));
    } catch (e) {
      setError(getUserFacingError(e));
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [domainFilter, resolvedChildAgeMonths]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedId('');
    setDomainFilter('');
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadActivities();
  }, [open, loadActivities]);

  const domains = useMemo(
    () =>
      [...new Set(activities.map((a) => String(a.domain || '').trim()).filter(Boolean))].sort(),
    [activities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter((a) => {
      if (!q) return true;
      const hay = [
        a.title,
        a.domain,
        a.instructions,
        activityAgeLabel(a.min_age_months, a.max_age_months),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activities, query]);

  const selected = activities.find((a) => a.activity_id === selectedId);

  const assign = async () => {
    if (!selected) {
      setError('Select an activity from the library.');
      return;
    }
    if (!Number.isFinite(childId)) {
      setError('Invalid child.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await therapistModel.children.createAssignment(childId, buildAssignmentFromActivity(selected));
      if (typeof onAssigned === 'function') onAssigned(selected);
      onClose?.();
    } catch (e) {
      setError(getUserFacingError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    activities,
    loading,
    query,
    setQuery,
    domainFilter,
    setDomainFilter,
    selectedId,
    setSelectedId,
    submitting,
    error,
    resolvedChildAgeMonths,
    domains,
    filtered,
    selected,
    assign,
    activityAgeLabel,
  };
}
