import { Modal, Btn, Badge } from './ui/TherapistUI';
import { useActivityLibraryAssign } from '../../controllers/therapist/useActivityLibraryAssign';

export default function ActivityLibraryAssignModal({
  open,
  onClose,
  childId,
  childName,
  childAgeMonths,
  childDateOfBirth,
  onAssigned,
}) {
  const {
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
  } = useActivityLibraryAssign({
    open,
    childId,
    childAgeMonths,
    childDateOfBirth,
    onAssigned,
    onClose,
  });

  return (
    <Modal
      open={open}
      title="Assign activity from library"
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={assign} disabled={submitting || !selectedId}>
            {submitting ? 'Assigning…' : 'Assign to child'}
          </Btn>
        </>
      }
    >
      {childName && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Assigning to <strong style={{ color: 'var(--text)' }}>{childName}</strong>
          {Number.isFinite(resolvedChildAgeMonths) && (
            <>
              {' '}
              · showing activities for{' '}
              <strong style={{ color: 'var(--text)' }}>{resolvedChildAgeMonths} months</strong>
            </>
          )}
        </p>
      )}

      {error && <div className="td-alert td-alert-error">{error}</div>}

      <div className="td-field" style={{ marginBottom: 12 }}>
        <label className="td-label" htmlFor="activity-search">
          Search activities
        </label>
        <input
          id="activity-search"
          className="td-input"
          placeholder="Search by title, domain, or instructions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
        />
      </div>

      {domains.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            className="td-badge"
            style={{
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: !domainFilter ? 'rgba(var(--green-rgb),0.12)' : 'transparent',
              color: !domainFilter ? 'var(--accent)' : 'var(--muted)',
            }}
            onClick={() => setDomainFilter('')}
          >
            All
          </button>
          {domains.map((d) => (
            <button
              key={d}
              type="button"
              className="td-badge"
              style={{
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: domainFilter === d ? 'rgba(var(--green-rgb),0.12)' : 'transparent',
                color: domainFilter === d ? 'var(--accent)' : 'var(--muted)',
              }}
              onClick={() => setDomainFilter((prev) => (prev === d ? '' : d))}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          maxHeight: 320,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--surface2)',
        }}
      >
        {loading && (
          <p style={{ padding: 16, fontSize: 13, color: 'var(--muted)' }}>Loading activities…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p style={{ padding: 16, fontSize: 13, color: 'var(--muted)' }}>
            {Number.isFinite(resolvedChildAgeMonths)
              ? `No activities match this child's age (${resolvedChildAgeMonths} months). Try another domain or add activities for this age band.`
              : 'No activities found in the library.'}
          </p>
        )}
        {!loading &&
          filtered.map((a) => {
            const isSelected = a.activity_id === selectedId;
            return (
              <button
                key={a.activity_id}
                type="button"
                onClick={() => setSelectedId(a.activity_id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: isSelected ? 'rgba(var(--green-rgb),0.1)' : 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
                  {a.domain && <Badge tone="info">{a.domain}</Badge>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {activityAgeLabel(a.min_age_months, a.max_age_months)}
                </div>
                {a.instructions && (
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--muted)',
                      marginTop: 6,
                      marginBottom: 0,
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {a.instructions}
                  </p>
                )}
              </button>
            );
          })}
      </div>

      {selected && (
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          Selected: <strong style={{ color: 'var(--text)' }}>{selected.title}</strong>
        </p>
      )}
    </Modal>
  );
}
