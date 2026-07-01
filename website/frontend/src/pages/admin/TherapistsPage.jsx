import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminModel } from '../../models/adminModel.js';
import { getErrorMessage } from '../../utils/errorMessages.js';
import { PASSWORD_POLICY_HINT, validateNewPassword } from '../../utils/passwordPolicy.js';
import { AdminModal, ConfirmDialog } from '../../components/admin/ui';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font)',
  boxSizing: 'border-box',
};

const th = {
  padding: '12px 14px',
  textAlign: 'left',
  color: 'var(--muted)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
};

const td = { padding: '12px 14px', fontSize: 13, verticalAlign: 'middle' };

const PROFESSION_OPTIONS = ['Speech Therapy', 'Psychomotor Therapy'];

const YEARS_OPTIONS = [
  ...Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: `${i} year${i === 1 ? '' : 's'}` })),
  { value: '10+', label: '10+ years' },
];

const EMPTY_ADD = {
  full_name: '',
  profession: '',
  bio: '',
  phone: '',
  address: '',
  years_of_experience: '',
  email: '',
  password: '',
};

function TherapistStatusBadge({ t }) {
  if (t.is_suspended) {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>
        Suspended
      </span>
    );
  }
  if (t.is_verified) {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(var(--green-rgb),0.12)', color: 'var(--accent)' }}>
        Verified
      </span>
    );
  }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
      Unverified
    </span>
  );
}

function ActionBtn({ children, onClick, disabled, tone = 'default' }) {
  const tones = {
    default: { border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' },
    accent: { border: '1px solid rgba(var(--green-rgb),0.35)', background: 'rgba(var(--green-rgb),0.08)', color: 'var(--accent)' },
    warn: { border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.08)', color: '#fbbf24' },
    danger: { border: '1px solid #FCA5A5', background: 'rgba(239,68,68,0.08)', color: '#DC2626' },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...tones[tone],
        borderRadius: 8,
        padding: '5px 9px',
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'var(--font)',
      }}
    >
      {children}
    </button>
  );
}

function TherapistFormModal({ title, form, setForm, specializations, onSubmit, onClose, error }) {
  const [showPassword, setShowPassword] = useState(false);
  const compactInputStyle = { ...inputStyle, padding: '6px 8px', fontSize: 12 };

  useEffect(() => {
    setShowPassword(false);
    setForm((prev) => (prev.password ? { ...prev, password: '' } : prev));
  }, [setForm]);

  return (
    <AdminModal title={title} onClose={onClose} compact>
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {[
            { key: 'full_name', label: 'Full name', required: true, placeholder: 'Enter full name' },
            { key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter email' },
            { key: 'profession', label: 'Profession', select: true, required: true },
            { key: 'phone', label: 'Phone', placeholder: 'Enter phone' },
            { key: 'address', label: 'Address', required: true, placeholder: 'Enter address' },
            { key: 'years_of_experience', label: 'Years of experience', type: 'number', placeholder: 'Enter years of experience' },
            { key: 'bio', label: 'Bio', textarea: true, placeholder: 'Enter brief professional background' },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>
                {f.label}
              </label>
              {f.select ? (
                <select
                  value={form.profession}
                  required={f.required}
                  onChange={(e) => setForm((p) => ({ ...p, profession: e.target.value }))}
                  style={{ ...compactInputStyle, cursor: 'pointer' }}
                >
                  <option value="">Select profession</option>
                  {specializations.map((s) => (
                    <option key={s.specialization_id} value={s.specialization_name}>
                      {s.specialization_name}
                    </option>
                  ))}
                  {form.profession &&
                    !specializations.some((s) => s.specialization_name === form.profession) && (
                      <option value={form.profession}>{form.profession}</option>
                    )}
                </select>
              ) : f.textarea ? (
                <textarea
                  value={form.bio}
                  rows={2}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  style={{ ...compactInputStyle, resize: 'vertical' }}
                />
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.key]}
                  required={f.required}
                  disabled={f.disabled}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  style={compactInputStyle}
                />
              )}
            </div>
          ))}

          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>
              Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="noumouw-therapist-add-password"
              value={form.password}
              required
              minLength={8}
              placeholder="enter password"
              autoComplete="new-password"
              readOnly
              onFocus={(e) => e.target.removeAttribute('readonly')}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              style={compactInputStyle}
            />
            <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>
              {PASSWORD_POLICY_HINT}
            </p>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ marginTop: 4, fontSize: 11, border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer' }}
            >
              {showPassword ? 'Hide' : 'Show'} password
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={Boolean(form.online_consultation)}
              onChange={(e) => setForm((p) => ({ ...p, online_consultation: e.target.checked }))}
            />
            Online consultation enabled
          </label>

          {error ? <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p> : null}

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent-gradient)',
                color: 'var(--text-on-accent)',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Save
            </button>
            <ActionBtn onClick={onClose}>Cancel</ActionBtn>
          </div>
        </form>
    </AdminModal>
  );
}

export default function Therapists() {
  const [therapists, setTherapists] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [addError, setAddError] = useState('');

  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminModel.therapists.list();
      setTherapists(data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    }

    try {
      const { data } = await adminModel.therapists.specializations();
      setSpecializations(
        Array.isArray(data) && data.length
          ? data
          : PROFESSION_OPTIONS.map((name, index) => ({
              specialization_id: index + 1,
              specialization_name: name,
            })),
      );
    } catch {
      setSpecializations(
        PROFESSION_OPTIONS.map((name, index) => ({
          specialization_id: index + 1,
          specialization_name: name,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTherapists = useMemo(() => {
    const q = search.toLowerCase();
    return therapists.filter((t) =>
      `${t.full_name ?? ''} ${t.profession ?? ''} ${t.email ?? ''}`.toLowerCase().includes(q),
    );
  }, [therapists, search]);

  const patchTherapist = (therapistId, patch) => {
    setTherapists((prev) =>
      prev.map((t) => (t.therapist_id === therapistId ? { ...t, ...patch } : t)),
    );
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { type, target } = confirm;
    setBusyId(target.therapist_id);
    setError('');
    try {
      if (type === 'suspend-therapist') {
        const { data } = await adminModel.therapists.suspend(target.therapist_id);
        patchTherapist(target.therapist_id, data);
      } else if (type === 'reactivate-therapist') {
        const { data } = await adminModel.therapists.reactivate(target.therapist_id);
        patchTherapist(target.therapist_id, data);
      } else if (type === 'delete-therapist') {
        await adminModel.therapists.delete(target.therapist_id);
        setTherapists((prev) => prev.filter((t) => t.therapist_id !== target.therapist_id));
      }
      setConfirm(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    setAddError('');
    const passwordError = validateNewPassword(addForm.password);
    if (passwordError) {
      setAddError(passwordError);
      return;
    }
    try {
      await adminModel.therapists.create(addForm);
      setShowAdd(false);
      setAddForm(EMPTY_ADD);
      await load();
    } catch (err) {
      setAddError(getErrorMessage(err));
    }
  };

  const confirmCopy = useMemo(() => {
    if (!confirm) return null;
    const { type, target } = confirm;
    if (type === 'suspend-therapist') {
      return {
        title: 'Suspend therapist?',
        message: `Suspend "${target.full_name}"? They will not be able to use the platform until reactivated.`,
        confirmLabel: 'Suspend',
        tone: 'warn',
      };
    }
    if (type === 'reactivate-therapist') {
      return {
        title: 'Reactivate therapist?',
        message: `Restore access for "${target.full_name}"?`,
        confirmLabel: 'Reactivate',
        tone: 'accent',
      };
    }
    if (type === 'delete-therapist') {
      return {
        title: 'Delete therapist?',
        message: `Permanently delete "${target.full_name}" from therapists? This cannot be undone.`,
        confirmLabel: 'Delete',
        tone: 'danger',
      };
    }
    return null;
  }, [confirm]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 28,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Therapists</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            {loading ? 'Loading…' : `${therapists.length} in directory`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            placeholder="Search therapists…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 200 }}
          />
          <button
            type="button"
            onClick={() => {
              setShowAdd(true);
              setAddForm(EMPTY_ADD);
              setAddError('');
            }}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: 'var(--accent-gradient)',
              border: 'none',
              color: 'var(--text-on-accent)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            + Add Therapist
          </button>
        </div>
      </div>

      {error ? <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</div> : null}

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Therapists directory</h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : filteredTherapists.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No therapists found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {[
                    'Full Name',
                    'Profession',
                    'Email',
                    'Phone',
                    'Address',
                    'Experience',
                    'Online',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTherapists.map((t) => (
                  <tr key={t.therapist_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{t.full_name || '—'}</td>
                    <td style={td}>{t.profession || '—'}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{t.email}</td>
                    <td style={td}>{t.phone || '—'}</td>
                    <td style={{ ...td, maxWidth: 140 }} title={t.address || ''}>
                      {t.address ? (t.address.length > 36 ? `${t.address.slice(0, 36)}…` : t.address) : '—'}
                    </td>
                    <td style={td}>{t.years_of_experience ?? '—'}</td>
                    <td style={td}>{t.online_consultation ? 'Yes' : 'No'}</td>
                    <td style={td}>
                      <TherapistStatusBadge t={t} />
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {t.is_suspended ? (
                          <ActionBtn
                            tone="accent"
                            disabled={busyId === t.therapist_id}
                            onClick={() => setConfirm({ type: 'reactivate-therapist', target: t })}
                          >
                            Reactivate
                          </ActionBtn>
                        ) : (
                          <ActionBtn
                            tone="warn"
                            disabled={busyId === t.therapist_id}
                            onClick={() => setConfirm({ type: 'suspend-therapist', target: t })}
                          >
                            Suspend
                          </ActionBtn>
                        )}
                        <ActionBtn
                          tone="danger"
                          disabled={busyId === t.therapist_id}
                          onClick={() => setConfirm({ type: 'delete-therapist', target: t })}
                        >
                          Delete
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showAdd ? (
        <TherapistFormModal
          key="add-therapist"
          title="Add therapist"
          form={addForm}
          setForm={setAddForm}
          specializations={specializations}
          error={addError}
          onClose={() => setShowAdd(false)}
          onSubmit={handleAdd}
        />
      ) : null}

      {confirm && confirmCopy ? (
        <ConfirmDialog
          open
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.confirmLabel}
          tone={confirmCopy.tone}
          submitting={Boolean(busyId)}
          onCancel={() => !busyId && setConfirm(null)}
          onConfirm={runConfirm}
        />
      ) : null}
    </div>
  );
}
