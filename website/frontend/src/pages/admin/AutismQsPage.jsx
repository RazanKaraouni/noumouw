import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../../utils/errorMessages.js';
import api from '../../services/axios';
import { adminModel } from '../../models/adminModel.js';
import { AdminModal } from '../../components/admin/ui';

const TARGET_COUNT = 20;

const EMPTY_FORM = {
  question_number: '',
  question_text: '',
  example_text: '',
  fail_answer: 'No',
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

function sortByQuestionNumber(list) {
  return [...list].sort(
    (a, b) => Number(a.question_number) - Number(b.question_number),
  );
}

function FailAnswerBadge({ value }) {
  const isYes = value === 'Yes';
  return (
    <span
      style={{
        padding: '3px 12px',
        borderRadius: 999,
        background: isYes ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
        color: isYes ? '#ef4444' : '#f59e0b',
        fontWeight: 600,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {value || '—'}
    </span>
  );
}

function FailAnswerToggle({ value, onChange, disabled }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        borderRadius: 10,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {['Yes', 'No'].map((option) => {
        const active = value === option;
        const isYes = option === 'Yes';
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            style={{
              padding: '10px 22px',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              fontSize: 13,
              fontWeight: 600,
              background: active
                ? isYes
                  ? 'rgba(239,68,68,0.2)'
                  : 'rgba(245,158,11,0.2)'
                : 'var(--surface2)',
              color: active
                ? isYes
                  ? '#ef4444'
                  : '#f59e0b'
                : 'var(--muted)',
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default function AutismQuestions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const sortedRows = useMemo(() => sortByQuestionNumber(rows), [rows]);
  const atTarget = rows.length === TARGET_COUNT;

  const loadQuestions = () => {
    setLoading(true);
    setError('');
    api
      .get('/autism/questions')
      .then((res) => setRows(res.data || []))
      .catch((err) =>
        setError(getErrorMessage(err)),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setActionError('');
    setShowAdd(true);
  };

  const openEdit = (question) => {
    setEditItem(question);
    setForm({
      question_number: question.question_number ?? '',
      question_text: question.question_text || '',
      example_text: question.example_text || '',
      fail_answer: question.fail_answer === 'Yes' ? 'Yes' : 'No',
    });
    setActionError('');
  };

  const formValid =
    String(form.question_number).trim() !== '' &&
    form.question_text.trim() !== '' &&
    form.example_text.trim() !== '' &&
    (form.fail_answer === 'Yes' || form.fail_answer === 'No');

  const buildPayload = () => {
    const num = Number(form.question_number);
    if (
      form.question_number === '' ||
      !Number.isFinite(num) ||
      !Number.isInteger(num) ||
      num < 1
    ) {
      throw new Error('Question number must be a positive whole number.');
    }
    return {
      question_number: num,
      question_text: form.question_text.trim(),
      example_text: form.example_text.trim(),
      fail_answer: form.fail_answer,
    };
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setActionError('');
    setSubmitting(true);
    try {
      const payload = buildPayload();
      await adminModel.autism.createQuestion(payload);
      setShowAdd(false);
      loadQuestions();
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
      const payload = buildPayload();
      await api.put(`/autism/questions/${editItem.autism_qs_id}`, payload);
      setEditItem(null);
      loadQuestions();
    } catch (err) {
      setActionError(
        getErrorMessage(err),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setActionError('');
    setSubmitting(true);
    try {
      await api.delete(`/autism/questions/${deleteItem.autism_qs_id}`);
      setDeleteItem(null);
      loadQuestions();
    } catch (err) {
      setActionError(
        getErrorMessage(err),
      );
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
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>
            Autism Screening Questions
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            M-CHAT-R/F question bank · Standardized assessment inventory · ordered by question number
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <CountBadge count={rows.length} target={TARGET_COUNT} atTarget={atTarget} />
          <button type="button" onClick={openAdd} style={addBtnStyle}>
            + Add Question
          </button>
        </div>
      </div>

      {!atTarget && !loading && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            background: rows.length > TARGET_COUNT
              ? 'rgba(248,113,113,0.08)'
              : 'rgba(245,158,11,0.08)',
            border: `1px solid ${rows.length > TARGET_COUNT ? 'rgba(248,113,113,0.25)' : 'rgba(245,158,11,0.25)'}`,
            color: rows.length > TARGET_COUNT ? 'var(--danger)' : '#f59e0b',
          }}
        >
          {rows.length < TARGET_COUNT
            ? `${TARGET_COUNT - rows.length} question${TARGET_COUNT - rows.length === 1 ? '' : 's'} missing — target is ${TARGET_COUNT} for a complete M-CHAT-R/F set.`
            : `${rows.length - TARGET_COUNT} extra question${rows.length - TARGET_COUNT === 1 ? '' : 's'} beyond the standard ${TARGET_COUNT}.`}
        </div>
      )}

      {loading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
      {error && (
        <div style={{ marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Question</th>
                <th style={thStyle}>Example</th>
                <th style={thStyle}>Fail answer</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...tdStyle,
                      textAlign: 'center',
                      color: 'var(--muted)',
                      padding: 48,
                    }}
                  >
                    No questions yet. Click &quot;+ Add Question&quot; to create the first one.
                  </td>
                </tr>
              ) : (
                sortedRows.map((q) => (
                  <tr key={q.autism_qs_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)', fontWeight: 600, width: 48 }}>
                      {q.question_number}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500, lineHeight: 1.5, maxWidth: 320 }}>
                      {q.question_text}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 280 }}>
                      {q.example_text || '—'}
                    </td>
                    <td style={tdStyle}>
                      <FailAnswerBadge value={q.fail_answer} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => openEdit(q)} style={editBtnStyle}>
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteItem(q)} style={deleteBtnStyle}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AdminModal title="Add Question" onClose={() => !submitting && setShowAdd(false)}>
          <QuestionForm
            form={form}
            setForm={setForm}
            error={actionError}
            submitting={submitting}
            onSubmit={handleAdd}
            onClose={() => setShowAdd(false)}
            submitLabel="Add Question"
            formValid={formValid}
          />
        </AdminModal>
      )}

      {editItem && (
        <AdminModal title="Edit Question" onClose={() => !submitting && setEditItem(null)}>
          <QuestionForm
            form={form}
            setForm={setForm}
            error={actionError}
            submitting={submitting}
            onSubmit={handleEdit}
            onClose={() => setEditItem(null)}
            submitLabel="Save Changes"
            formValid={formValid}
          />
        </AdminModal>
      )}

      {deleteItem && (
        <AdminModal title="Delete Question" onClose={() => !submitting && setDeleteItem(null)}>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            Delete question <strong>#{deleteItem.question_number}</strong>? Parents who already
            completed screenings may still reference historical answers. This cannot be undone.
          </p>
          {actionError && (
            <div style={{ marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
              {actionError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => setDeleteItem(null)}
              disabled={submitting}
              style={cancelBtnStyle}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDelete}
              style={deleteConfirmBtnStyle}
            >
              {submitting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function CountBadge({ count, target, atTarget }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 10,
        background: atTarget ? 'rgba(var(--green-rgb),0.12)' : 'var(--surface2)',
        border: `1px solid ${atTarget ? 'rgba(var(--green-rgb),0.35)' : 'var(--border)'}`,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Total</span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 18,
          fontWeight: 700,
          color: atTarget ? 'var(--green)' : 'var(--text)',
        }}
      >
        {count}
      </span>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ {target}</span>
    </div>
  );
}

function QuestionForm({
  form,
  setForm,
  error,
  submitting,
  onSubmit,
  onClose,
  submitLabel,
  formValid,
}) {
  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Question number *">
          <input
            type="number"
            min={1}
            step={1}
            required
            value={form.question_number}
            onChange={(e) =>
              setForm((p) => ({ ...p, question_number: e.target.value }))
            }
            style={inputStyle}
            placeholder="1–20"
          />
        </Field>

        <Field label="Question text *">
          <textarea
            rows={3}
            required
            value={form.question_text}
            onChange={(e) =>
              setForm((p) => ({ ...p, question_text: e.target.value }))
            }
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Full question shown to parents"
          />
        </Field>

        <Field label="Example text *">
          <textarea
            rows={2}
            required
            value={form.example_text}
            onChange={(e) =>
              setForm((p) => ({ ...p, example_text: e.target.value }))
            }
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Clarifying example for this item"
          />
        </Field>

        <Field label="Fail answer *">
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
            The parent&apos;s answer that counts as a failed (at-risk) response for scoring.
          </p>
          <FailAnswerToggle
            value={form.fail_answer}
            onChange={(v) => setForm((p) => ({ ...p, fail_answer: v }))}
            disabled={submitting}
          />
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
        <button
          type="submit"
          disabled={submitting || !formValid}
          style={{
            ...submitBtnStyle,
            opacity: submitting || !formValid ? 0.6 : 1,
            cursor: submitting || !formValid ? 'not-allowed' : 'pointer',
          }}
        >
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

const thStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--muted)',
};

const tdStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  verticalAlign: 'top',
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