import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../../utils/errorMessages.js';
import api from '../../services/axios';
import { CDC_MILESTONE_AGE_RANGES } from '../../constants/cdcMilestoneAgeTiers';
import { labelForAgeBounds, agePresetKeyFromBounds, milestoneFieldsFromAgePreset, activityAgeFieldsFromPreset } from '../../utils/milestoneAgeTier';
import BankGridCard, { BankGrid } from '../../components/admin/BankGridCard';
import { AdminModal } from '../../components/admin/ui';

const ADMIN_DOMAINS = ['cognitive', 'motor', 'language', 'social'];
const THERAPIST_DOMAINS = ['speech', 'language', 'cognitive', 'motor', 'social'];
/** Domains persisted in `activity_library` (matches DB check constraint). */
const THERAPIST_FORM_DOMAINS = ['cognitive', 'motor', 'language', 'social'];

const DOMAIN_COLORS = {
  speech:    { bg: 'rgba(246,173,85,0.14)', text: '#ed8936' },
  cognitive: { bg: 'rgba(99,179,237,0.12)', text: '#63b3ed' },
  motor:     { bg: 'rgba(154,230,180,0.12)', text: '#68d391' },
  language:  { bg: 'rgba(251,211,141,0.12)', text: '#f6ad55' },
  social:    { bg: 'rgba(214,188,250,0.12)', text: '#b794f4' },
};

const AGE_RANGES = CDC_MILESTONE_AGE_RANGES;

const EMPTY = {
  title: '',
  description: '',
  domain: '',
  age_preset: '',
};

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none',
};

const selectStyle = { ...inputStyle };

function domainBadge(domain) {
  const dc = DOMAIN_COLORS[domain] || { bg: 'rgba(255,255,255,0.05)', text: 'var(--muted)' };
  return (
    <span
      style={{
        background: dc.bg,
        color: dc.text,
        padding: '2px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {domain || 'unknown'}
    </span>
  );
}

function bankCardActions({ onEdit, onDelete }) {
  return (
    <>
      <button type="button" onClick={onEdit} style={bankEditBtnStyle}>
        Edit
      </button>
      <button type="button" onClick={onDelete} style={bankDeleteBtnStyle}>
        Delete
      </button>
    </>
  );
}

const bankEditBtnStyle = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 12px',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'var(--font)',
};

const bankDeleteBtnStyle = {
  ...bankEditBtnStyle,
  color: 'var(--muted)',
};

export default function Milestones({ variant = 'admin' }) {
  const isTherapist = variant === 'therapist';
  const pageTitle = isTherapist ? 'Activities' : 'Milestone Bank';
  const DOMAINS = isTherapist ? THERAPIST_DOMAINS : ADMIN_DOMAINS;
  const [milestones, setMilestones]   = useState([]);
  const [search, setSearch]           = useState('');
  const [filterAgeRange, setFilterAgeRange] = useState('');
  const [activeDomain, setActiveDomain] = useState('');
  const [showAdd, setShowAdd]         = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [editId, setEditId]           = useState(null);
  const [deleteId, setDeleteId]       = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [error, setError]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const formatDomain = (domain) =>
    String(domain || '').trim().toLowerCase();

  const normalizeMilestone = (m) => ({
    ...m,
    age_months_min: Number(m.age_months_min),
    age_months_max: Number(m.age_months_max),
    age_range:
      (typeof m.age_range === 'string' && m.age_range.trim()) ||
      labelForAgeBounds(Number(m.age_months_min), Number(m.age_months_max)),
    title: m.title || 'Untitled milestone',
    domain: formatDomain(m.domain),
  });

  const normalizeActivityLibraryRow = (row) => ({
    ...row,
    milestones_id: row.activity_id,
    age_months_min: Number(row.min_age_months),
    age_months_max: Number(row.max_age_months),
    title: row.title || 'Untitled activity',
    domain: formatDomain(row.domain),
    description: row.instructions || '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isTherapist) {
        setError('');
        try {
          const r = await api.get('/activities', {
            params: activeDomain ? { domain: activeDomain } : undefined,
          });
          if (cancelled) return;
          setMilestones((r.data || []).map(normalizeActivityLibraryRow));
        } catch (err) {
          if (!cancelled) {
            setError(getErrorMessage(err));
          }
        }
        return;
      }
      setError('');
      try {
        const r = await api.get('/milestones');
        if (cancelled) return;
        setMilestones((r.data || []).map(normalizeMilestone));
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTherapist]);

  /* helpers */
  const openAdd = () => { setForm(EMPTY); setError(''); setShowAdd(true); };
  const openEdit = (m) => {
    setEditId(m.milestones_id);
    setForm({
      title: m.title,
      description: m.description || '',
      domain: m.domain,
      age_preset: agePresetKeyFromBounds(m.age_months_min, m.age_months_max),
    });
    setError('');
    setShowEdit(true);
  };

  const handleAgeRange = (e, setF) => {
    setF((p) => ({ ...p, age_preset: e.target.value }));
  };

  const buildMilestoneSubmitPayload = () => {
    const ageFields = milestoneFieldsFromAgePreset(form.age_preset);
    if (!ageFields) {
      throw new Error('Select an age range preset.');
    }
    return {
      title: form.title.trim(),
      description: form.description?.trim() || '',
      domain: form.domain,
      ...ageFields,
    };
  };

  const buildActivitySubmitPayload = () => {
    const ageFields = activityAgeFieldsFromPreset(form.age_preset);
    if (!ageFields) {
      throw new Error('Select an age band preset.');
    }
    return {
      title: form.title.trim(),
      instructions: form.description?.trim() || '',
      domain: form.domain,
      ...ageFields,
    };
  };

  /* CRUD */
  const reloadAdminMilestones = () =>
    api
      .get('/milestones')
      .then((r) => setMilestones((r.data || []).map(normalizeMilestone)))
      .catch((err) =>
        setError(getErrorMessage(err)),
      );

  const reloadTherapistActivities = () =>
    api
      .get('/activities', { params: activeDomain ? { domain: activeDomain } : undefined })
      .then((r) => setMilestones((r.data || []).map(normalizeActivityLibraryRow)))
      .catch((err) =>
        setError(getErrorMessage(err)),
      );

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isTherapist) {
        const payload = buildActivitySubmitPayload();
        await api.post('/activities', payload);
        setShowAdd(false);
        await reloadTherapistActivities();
      } else {
        const payload = buildMilestoneSubmitPayload();
        await api.post('/milestones', payload);
        setShowAdd(false);
        await reloadAdminMilestones();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isTherapist) {
        const payload = buildActivitySubmitPayload();
        await api.put(`/activities/${editId}`, payload);
        setShowEdit(false);
        await reloadTherapistActivities();
      } else {
        const payload = buildMilestoneSubmitPayload();
        await api.put(`/milestones/${editId}`, payload);
        setShowEdit(false);
        await reloadAdminMilestones();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setDeleteSubmitting(true);
    try {
      if (isTherapist) {
        await api.delete(`/activities/${deleteId}`);
        await reloadTherapistActivities();
      } else {
        await api.delete(`/milestones/${deleteId}`);
        await reloadAdminMilestones();
      }
      setDeleteId(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleteId(null);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const domainCounts = useMemo(() => {
    if (isTherapist) return {};
    const counts = Object.fromEntries(ADMIN_DOMAINS.map((d) => [d, 0]));
    for (const m of milestones) {
      if (m.domain && counts[m.domain] != null) counts[m.domain] += 1;
    }
    return counts;
  }, [milestones, isTherapist]);

  /* filter */
  const activityDomains = Array.from(
    new Set(milestones.map((m) => m.domain).filter(Boolean)),
  ).sort();
  const displayedDomains = isTherapist ? activityDomains : DOMAINS;
  const displayedAgeRanges = isTherapist
    ? Array.from(
        new Map(
          milestones
            .filter((m) => Number.isFinite(m.age_months_min) && Number.isFinite(m.age_months_max))
            .map((m) => [
              `${m.age_months_min}-${m.age_months_max}`,
              {
                label: m.age_range || labelForAgeBounds(m.age_months_min, m.age_months_max),
                min: m.age_months_min,
                max: m.age_months_max,
              },
            ]),
        ).values(),
      ).sort((a, b) => a.min - b.min || a.max - b.max)
    : AGE_RANGES;

  const filtered = milestones.filter(m => {
    const q = search.toLowerCase();
    const matchSearch =
      m.title.toLowerCase().includes(q) ||
      (m.description && String(m.description).toLowerCase().includes(q));
    const matchDomain = activeDomain ? m.domain === activeDomain : true;
    const selectedAge = displayedAgeRanges.find(r => `${r.min}-${r.max}` === filterAgeRange);
    const matchAge = selectedAge
      ? m.age_months_min === selectedAge.min && m.age_months_max === selectedAge.max
      : true;
    return matchSearch && matchDomain && matchAge;
  });

  /* group by age_range (admin) or CDC bands (therapist) */
  const grouped = useMemo(() => {
    if (isTherapist) {
      return displayedAgeRanges
        .map((range) => ({
          ...range,
          items: filtered.filter(
            (m) => m.age_months_min === range.min && m.age_months_max === range.max,
          ),
        }))
        .filter((g) => g.items.length > 0);
    }
    const map = new Map();
    for (const m of filtered) {
      const label =
        m.age_range || labelForAgeBounds(m.age_months_min, m.age_months_max);
      if (!map.has(label)) {
        map.set(label, {
          label,
          items: [],
          sortMin: Number(m.age_months_min) || 0,
        });
      }
      const g = map.get(label);
      g.items.push(m);
      g.sortMin = Math.min(g.sortMin, Number(m.age_months_min) || 0);
    }
    return Array.from(map.values()).sort((a, b) => a.sortMin - b.sortMin);
  }, [filtered, displayedAgeRanges, isTherapist]);

  const outOfRangeItems = isTherapist
    ? filtered.filter(
        (m) =>
          !displayedAgeRanges.some(
            (r) => m.age_months_min === r.min && m.age_months_max === r.max,
          ),
      )
    : [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>{pageTitle}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            {isTherapist
              ? `${milestones.length} verified developmental exercise${milestones.length !== 1 ? 's' : ''} · Used when assigning home activities to families.`
              : `${filtered.length} of ${milestones.length} milestone${milestones.length !== 1 ? 's' : ''} · grouped by age range`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            placeholder={isTherapist ? 'Search activities…' : 'Search milestones…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 200 }}
          />
          <select value={filterAgeRange} onChange={e => setFilterAgeRange(e.target.value)} style={{ ...selectStyle, width: 160 }}>
            <option value="">All ages</option>
            {displayedAgeRanges.map(r => (
              <option key={`${r.min}-${r.max}`} value={`${r.min}-${r.max}`}>{r.label}</option>
            ))}
          </select>
          <button onClick={openAdd} style={{
            padding: '10px 20px', borderRadius: 10, background: 'var(--accent-gradient)',
            border: 'none', color: 'var(--text-on-accent)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap',
          }}>{isTherapist ? '+ Add activity' : '+ Add milestone'}</button>
        </div>
      </div>

      {/* Domain filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveDomain('')} style={{
          background: activeDomain === '' ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: 'var(--text)',
          padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
          border: '1px solid var(--border)',
          cursor: 'pointer',
          fontFamily: 'var(--font)',
        }}>All domains</button>
        {displayedDomains.map(d => {
          const count = isTherapist ? null : domainCounts[d];
          return (
          <button key={d} onClick={() => setActiveDomain(prev => prev === d ? '' : d)} style={{
            background: activeDomain === d ? DOMAIN_COLORS[d]?.bg || 'rgba(255,255,255,0.08)' : 'transparent',
            color: DOMAIN_COLORS[d]?.text || 'var(--muted)',
            padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            border: `1px solid ${DOMAIN_COLORS[d]?.text || 'var(--border)'}`,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
            {!isTherapist && count != null && (
              <span style={{
                background: activeDomain === d ? 'rgba(0,0,0,0.15)' : 'var(--surface2)',
                padding: '1px 7px',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'var(--mono)',
              }}>{count}</span>
            )}
          </button>
        );})}
      </div>

      {error && (
        <div style={{
          marginBottom: 16, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Grouped list */}
      {grouped.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60 }}>
          {isTherapist
            ? 'No activities match your filters. Adjust search, age band, or domain — or add a new activity.'
            : 'No milestones found. Click "+ Add milestone" to get started.'}
        </div>
      )}

      {grouped.map(group => (
        <div key={group.label} style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em',
            textTransform: 'uppercase', fontFamily: 'var(--mono)',
            marginBottom: 12, paddingBottom: 8,
            borderBottom: '1px solid var(--border)',
          }}>
            {group.label}
          </div>

          <BankGrid>
            {group.items.map((m) => (
              <BankGridCard
                key={m.milestones_id}
                title={m.title}
                badge={domainBadge(m.domain)}
                description={m.description}
                actions={bankCardActions({
                  onEdit: () => openEdit(m),
                  onDelete: () => setDeleteId(m.milestones_id),
                })}
              />
            ))}
          </BankGrid>
        </div>
      ))}

      {outOfRangeItems.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em',
            textTransform: 'uppercase', fontFamily: 'var(--mono)',
            marginBottom: 12, paddingBottom: 8,
            borderBottom: '1px solid var(--border)',
          }}>
            Other age ranges
          </div>
          <BankGrid>
            {outOfRangeItems.map((m) => (
              <BankGridCard
                key={m.milestones_id}
                title={m.title}
                badge={domainBadge(m.domain)}
                meta={labelForAgeBounds(m.age_months_min, m.age_months_max)}
                description={m.description}
                actions={bankCardActions({
                  onEdit: () => openEdit(m),
                  onDelete: () => setDeleteId(m.milestones_id),
                })}
              />
            ))}
          </BankGrid>
        </div>
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <AdminModal title={isTherapist ? 'Add activity' : 'Add Milestone'} onClose={() => setShowAdd(false)}>
          <MilestoneForm
            form={form} setForm={setForm} error={error}
            submitting={submitting} onSubmit={handleAdd}
            onClose={() => setShowAdd(false)}
            handleAgeRange={handleAgeRange}
            submitLabel={isTherapist ? 'Add activity' : 'Add Milestone'}
            domainOptions={isTherapist ? THERAPIST_FORM_DOMAINS : ['cognitive', 'motor', 'language', 'social']}
            agePresetLabel={isTherapist ? 'Age Band Preset *' : 'Age Range Preset *'}
          />
        </AdminModal>
      )}

      {/* EDIT MODAL */}
      {showEdit && (
        <AdminModal title={isTherapist ? 'Edit activity' : 'Edit Milestone'} onClose={() => setShowEdit(false)}>
          <MilestoneForm
            form={form} setForm={setForm} error={error}
            submitting={submitting} onSubmit={handleEdit}
            onClose={() => setShowEdit(false)}
            handleAgeRange={handleAgeRange}
            submitLabel="Save Changes"
            domainOptions={isTherapist ? THERAPIST_FORM_DOMAINS : ['cognitive', 'motor', 'language', 'social']}
            agePresetLabel={isTherapist ? 'Age Band Preset *' : 'Age Range Preset *'}
          />
        </AdminModal>
      )}

      {/* DELETE MODAL */}
      {deleteId && (
        <AdminModal title={isTherapist ? 'Delete activity' : 'Delete Milestone'} onClose={() => setDeleteId(null)}>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            This {isTherapist ? 'activity' : 'milestone'} will be removed from all mobile app checklists. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => !deleteSubmitting && setDeleteId(null)} style={{
              flex: 1, padding: '10px', borderRadius: 8, background: 'transparent',
              border: '1px solid var(--border)', color: 'var(--muted)',
              cursor: deleteSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
            }}>{isTherapist ? 'Close' : 'Cancel'}</button>
            <button type="button" disabled={deleteSubmitting} onClick={handleDelete} style={{
              flex: 1, padding: '10px', borderRadius: 8, background: 'var(--danger)',
              border: 'none', color: '#fff', fontWeight: 600,
              cursor: deleteSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
              opacity: deleteSubmitting ? 0.7 : 1,
            }}>{deleteSubmitting ? 'Deleting…' : 'Delete'}</button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

/* ── Form ── */
function MilestoneForm({
  form,
  setForm,
  error,
  submitting,
  onSubmit,
  onClose,
  handleAgeRange,
  submitLabel,
  domainOptions,
  agePresetLabel = 'Age Range Preset *',
}) {
  const domains = domainOptions || ['cognitive', 'motor', 'language', 'social'];

  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Title *</label>
          <input
            type="text" required placeholder="e.g. Sits without support"
            value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Description</label>
          <textarea
            placeholder="Optional details shown in the mobile app…"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Domain *</label>
          <select
            required value={form.domain}
            onChange={e => setForm(p => ({ ...p, domain: e.target.value }))}
            style={selectStyle}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          >
            <option value="">Select domain</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{agePresetLabel}</label>
          <select
            required
            value={form.age_preset}
            onChange={e => handleAgeRange(e, setForm)}
            style={selectStyle}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          >
            <option value="">Select preset</option>
            {AGE_RANGES.map(r => (
              <option key={`${r.min}-${r.max}`} value={`${r.min}-${r.max}`}>{r.label}</option>
            ))}
          </select>
        </div>

      </div>

      {error && (
        <div style={{
          marginTop: 16, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13,
        }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button type="button" onClick={onClose} style={{
          flex: 1, padding: '11px', borderRadius: 10, background: 'transparent',
          border: '1px solid var(--border)', color: 'var(--muted)',
          cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 14,
        }}>Cancel</button>
        <button type="submit" disabled={submitting} style={{
          flex: 1, padding: '11px', borderRadius: 10, background: 'var(--accent-gradient)',
          border: 'none', color: 'var(--text-on-accent)', fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', fontSize: 14,
        }}>{submitting ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
