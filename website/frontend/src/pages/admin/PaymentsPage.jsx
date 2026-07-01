import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUserFacingError } from '../../utils/errorFeedback.js';
import { adminModel } from '../../models/adminModel.js';
import PaymentStatusTrendChart from '../../components/payments/PaymentStatusTrendChart.jsx';
import SessionPaymentsTable from '../../components/payments/SessionPaymentsTable.jsx';

export default function PaymentsPage() {
  const [allItems, setAllItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [therapistFilter, setTherapistFilter] = useState('');

  const tableItems = useMemo(() => {
    if (!statusFilter) return allItems;
    return allItems.filter(
      (row) => String(row.status || '').toLowerCase() === statusFilter,
    );
  }, [allItems, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 500 };
      if (therapistFilter) params.therapistId = therapistFilter;

      const { data } = await adminModel.payments.list(params);
      setAllItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getUserFacingError(err));
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [therapistFilter]);

  useEffect(() => {
    adminModel.therapists
      .list()
      .then((res) => setTherapists(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PaymentStatusTrendChart items={allItems} loading={loading} />
      <SessionPaymentsTable
        role="admin"
        items={tableItems}
        loading={loading}
        error={error}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        therapistFilter={therapistFilter}
        onTherapistFilterChange={setTherapistFilter}
        therapists={therapists}
        onRefresh={load}
      />
    </>
  );
}
