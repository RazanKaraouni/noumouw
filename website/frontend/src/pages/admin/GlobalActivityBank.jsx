import { getErrorMessage } from '../../utils/errorMessages.js';
import { useEffect, useMemo, useState } from 'react';
import api from '../../services/axios';
import { CDC_MILESTONE_AGE_RANGES } from '../../constants/cdcMilestoneAgeTiers';
import { labelForAgeBounds, agePresetKeyFromBounds, activityAgeFieldsFromPreset } from '../../utils/milestoneAgeTier';
import BankGridCard, { BankGrid } from '../../components/admin/BankGridCard';
import { AdminAlert, AdminModal, DialogButton, DialogFooter } from '../../components/admin/ui';

const DOMAINS = ['Cognitive', 'Motor', 'Social', 'Language'];
const AGE_FILTER_OPTIONS = CDC_MILESTONE_AGE_RANGES;

const DOMAIN_COLORS = {
  cognitive: { bg: 'rgba(99,179,237,0.12)', text: '#63b3ed' },
  motor: { bg: 'rgba(154,230,180,0.12)', text: '#68d391' },
  language: { bg: 'rgba(251,211,141,0.12)', text: '#f6ad55' },
  social: { bg: 'rgba(214,188,250,0.12)', text: '#b794f4' },
};

const domainKey = (domain) => String(domain || '').trim().toLowerCase();

const domainColor = (domain) =>
  DOMAIN_COLORS[domainKey(domain)] || {
    bg: 'rgba(255,255,255,0.05)',
    text: 'var(--muted)',
  };

const EMPTY = {
  title: '',
  instructions: '',
  domain: '',
  age_preset: '',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font)',
  outline: 'none',
};

const addBtnStyle = {
  padding: '10px 20px',
  borderRadius: 10,
  background: 'var(--accent-gradient)',
  border: 'none',
  color: 'var(--text-on-accent)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  whiteSpace: 'nowrap',
};

function normalizeRow(row) {
  const min = Number(row.min_age_months);
  const max = Number(row.max_age_months);
  return {
    ...row,
    min_age_months: min,
    max_age_months: max,
    title: row.title || 'Untitled activity',
    instructions: row.instructions || '',
    domain: row.domain || '',
    ageLabel:
      Number.isFinite(min) && Number.isFinite(max)
        ? labelForAgeBounds(min, max)
        : '—',
  };
}

function matchesAgeFilter(row, filterKey) {
  if (!filterKey) return true;
  const tier = AGE_FILTER_OPTIONS.find((r) => `${r.min}-${r.max}` === filterKey);
  if (!tier) return true;
  return row.min_age_months === tier.min && row.max_age_months === tier.max;
}

export default function GlobalActivityBank() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [filterAgeRange, setFilterAgeRange] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const loadActivities = () => {
    setLoading(true);
    setError('');
    api
      .get('/activities')
      .then((res) => setRows((res.data || []).map(normalizeRow)))
      .catch((err) =>
        setError(getErrorMessage(err)),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      const matchSearch =
        row.title.toLowerCase().includes(q) ||
        row.instructions.toLowerCase().includes(q) ||
        row.ageLabel.toLowerCase().includes(q);
      return matchSearch && matchesAgeFilter(row, filterAgeRange);
    });
  }, [rows, search, filterAgeRange]);

  const groupedByDomain = useMemo(() => {
    const order = DOMAINS.map((d) => d.toLowerCase());
    const map = new Map();
    for (const row of filtered) {
      const key = domainKey(row.domain) || 'other';
      if (!map.has(key)) {
        map.set(key, {
          domain: row.domain || key,
          items: [],
        });
      }
      map.get(key).items.push(row);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ai = order.indexOf(domainKey(a.domain));
      const bi = order.indexOf(domainKey(b.domain));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filtered]);

  const openAdd = () => {
    setForm(EMPTY);
    setActionError('');
    setShowAdd(true);
  };

  const openEdit = (row) => {
    setEditItem(row);
    setForm({
      title: row.title || '',
      instructions: row.instructions || '',
      domain: row.domain || '',
      age_preset: agePresetKeyFromBounds(row.min_age_months, row.max_age_months),
    });
    setActionError('');
  };

  const handleAgePreset = (e) => {
    setForm((p) => ({ ...p, age_preset: e.target.value }));
  };

  const payloadFromForm = () => {
    const ageFields = activityAgeFieldsFromPreset(form.age_preset);
    if (!ageFields) {
      throw new Error('Select an age band preset.');
    }
    return {
      title: form.title.trim(),
      instructions: form.instructions.trim(),
      domain: form.domain,
      ...ageFields,
    };
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setActionError('');
    setSubmitting(true);
    try {
      await api.post('/activities', payloadFromForm());
      setShowAdd(false);
      loadActivities();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editItem) return;
    setActionError('');
    setSubmitting(true);
    try {
      await api.put(`/activities/${editItem.activity_id}`, payloadFromForm());
      setEditItem(null);
      loadActivities();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setActionError('');
    setSubmitting(true);
    try {
      await api.delete(`/activities/${deleteItem.activity_id}`);
      setDeleteItem(null);
      loadActivities();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>
            Global Activity Bank
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            {filtered.length === rows.length
              ? `${rows.length} verified developmental exercise${rows.length === 1 ? '' : 's'}`
              : `${filtered.length} of ${rows.length} verified developmental exercises`}
            {' '}· grouped by domain
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search activities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 200 }}
          />
          <select
            value={filterAgeRange}
            onChange={(e) => setFilterAgeRange(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          >
            <option value="">All ages</option>
            {AGE_FILTER_OPTIONS.map((r) => (
              <option key={`${r.min}-${r.max}`} value={`${r.min}-${r.max}`}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={openAdd} style={addBtnStyle}>
            + Add Activity
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}

      {loading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}

      {!loading && !error && groupedByDomain.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60 }}>
          No activities match your filters. Click &quot;+ Add Activity&quot; to create one.
        </div>
      )}

      {!loading &&
        !error &&
        groupedByDomain.map((group) => {
          const dc = domainColor(group.domain);
          return (
            <div key={domainKey(group.domain)} style={{ marginBottom: 28 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span
                  style={{
                    background: dc.bg,
                    color: dc.text,
                    padding: '4px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {group.domain}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--mono)',
                    color: 'var(--muted)',
                  }}
                >
                  {group.items.length}
                </span>
              </div>

              <BankGrid>
                {group.items.map((row) => (
                  <BankGridCard
                    key={row.activity_id}
                    title={row.title}
                    badge={
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--muted)',
                          whiteSpace: 'nowrap',
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        {row.ageLabel}
                      </span>
                    }
                    description={row.instructions}
                    actions={
                      <>
                        <button type="button" onClick={() => openEdit(row)} style={editBtnStyle}>
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteItem(row)} style={deleteBtnStyle}>
                          Delete
                        </button>
                      </>
                    }
                  />
                ))}
              </BankGrid>
            </div>
          );
        })}

      {showAdd && (
        <AdminModal title="Add Activity" onClose={() => !submitting && setShowAdd(false)}>
          <ActivityForm
            form={form}
            setForm={setForm}
            error={actionError}
            submitting={submitting}
            onSubmit={handleAdd}
            onClose={() => setShowAdd(false)}
            onAgePreset={handleAgePreset}
            submitLabel="Add Activity"
          />
        </AdminModal>
      )}

      {editItem && (
        <AdminModal title="Edit Activity" onClose={() => !submitting && setEditItem(null)}>
          <ActivityForm
            form={form}
            setForm={setForm}
            error={actionError}
            submitting={submitting}
            onSubmit={handleEdit}
            onClose={() => setEditItem(null)}
            onAgePreset={handleAgePreset}
            submitLabel="Save Changes"
          />
        </AdminModal>
      )}

      {deleteItem && (
        <AdminModal title="Delete Activity" onClose={() => !submitting && setDeleteItem(null)}>
          <p className="confirm-dialog-message" style={{ marginTop: 0 }}>
            Remove &quot;{deleteItem.title}&quot; from the global activity bank? This cannot be undone.
          </p>
          {actionError ? <AdminAlert>{actionError}</AdminAlert> : null}
          <DialogFooter>
            <DialogButton onClick={() => setDeleteItem(null)} disabled={submitting}>
              Cancel
            </DialogButton>
            <DialogButton variant="danger" disabled={submitting} onClick={handleDelete}>
              {submitting ? 'Deleting…' : 'Delete'}
            </DialogButton>
          </DialogFooter>
        </AdminModal>
      )}
    </div>
  );
}

function ActivityForm({
  form,
  setForm,
  error,
  submitting,
  onSubmit,
  onClose,
  onAgePreset,
  submitLabel,
}) {
  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Title *">
          <input
            type="text"
            required
            placeholder="e.g. Peek-a-boo with mirror"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            style={inputStyle}
          />
        </Field>

        <Field label="Instructions">
          <textarea
            rows={3}
            placeholder="Step-by-step guidance for families…"
            value={form.instructions}
            onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </Field>

        <Field label="Domain *">
          <select
            required
            value={form.domain}
            onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
            style={inputStyle}
          >
            <option value="">Select domain</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Age Band Preset *">
          <select
            required
            value={form.age_preset}
            onChange={onAgePreset}
            style={inputStyle}
          >
            <option value="">Select preset</option>
            {AGE_FILTER_OPTIONS.map((r) => (
              <option key={`${r.min}-${r.max}`} value={`${r.min}-${r.max}`}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button type="button" onClick={onClose} disabled={submitting} style={cancelBtnStyle}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} style={submitBtnStyle}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--muted)',
          display: 'block',
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const editBtnStyle = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 12px',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'var(--font)',
};

const deleteBtnStyle = {
  ...editBtnStyle,
  color: 'var(--muted)',
};

const cancelBtnStyle = {
  flex: 1,
  padding: '11px',
  borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  fontSize: 14,
};

const submitBtnStyle = {
  flex: 1,
  padding: '11px',
  borderRadius: 10,
  background: 'var(--accent-gradient)',
  border: 'none',
  color: 'var(--text-on-accent)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  fontSize: 14,
};

const deleteConfirmBtnStyle = {
  ...submitBtnStyle,
  background: 'var(--danger)',
  color: '#fff',
};