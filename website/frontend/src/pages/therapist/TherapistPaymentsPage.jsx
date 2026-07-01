import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUserFacingError } from '../../utils/errorFeedback.js';
import { therapistModel } from '../../models/therapistModel.js';
import SessionPaymentsTable from '../../components/payments/SessionPaymentsTable.jsx';

export default function TherapistPaymentsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await therapistModel.payments.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getUserFacingError(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((row) => String(row.status || '').toLowerCase() === statusFilter);
  }, [rows, statusFilter]);

  return (
    <SessionPaymentsTable
      role="therapist"
      items={items}
      loading={loading}
      error={error}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      onRefresh={load}
    />
  );
}
