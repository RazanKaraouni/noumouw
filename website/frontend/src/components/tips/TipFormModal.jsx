import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useEffect, useState } from 'react';
import apiClient from '../../services/axios.js';
import { Modal, Btn } from '../therapist/ui/TherapistUI.jsx';
import { PARENTING_HUB_CATEGORIES } from '../../constants/parentingHubCategories.js';
import {
  ageRangeFromTip,
  TIP_AGE_RANGE_OPTIONS,
  validateTipAgeRange,
} from '../../utils/tipAgeRange.js';

const emptyForm = () => ({
  title: '',
  category: 'child_development',
  content: '',
  ageRange: '',
});

function fieldErrorStyle() {
  return { fontSize: 12, color: 'var(--danger)', marginTop: 6 };
}

export default function TipFormModal({ tip, onClose, onSuccess }) {
  const tipId = tip?.tip_id ?? tip?.id;
  const isEdit = Boolean(tipId);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (tip) {
      setForm({
        title: tip.title || '',
        category: tip.category || 'child_development',
        content: tip.content || '',
        ageRange: ageRangeFromTip(tip),
      });
    } else {
      setForm(emptyForm());
    }
    setErrors({});
    setSubmitError('');
  }, [tip]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const next = {};
    const title = form.title.trim();
    const content = form.content.trim();
    const ageRangeError = validateTipAgeRange(form.ageRange);

    if (!title) next.title = 'Title is required.';
    else if (title.length > 100) next.title = 'Title must be 100 characters or fewer.';

    if (!form.category) next.category = 'Please select a category.';
    if (ageRangeError) next.ageRange = ageRangeError;

    if (!content) next.content = 'Content is required.';
    else if (content.length < 50) next.content = 'Please write at least 50 characters.';
    else if (content.length > 1000) next.content = 'Content must be 1000 characters or fewer.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError('');

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      age_range: form.ageRange.trim(),
    };

    try {
      if (isEdit) {
        await apiClient.patch(`/tips/${tipId}`, payload);
      } else {
        await apiClient.post('/tips', {
          ...payload,
          submitted_by_role: 'therapist',
        });
      }
      onSuccess?.();
    } catch (err) {
      setSubmitError(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={isEdit ? 'Edit tip' : 'Add new tip'}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Submit tip'}
          </Btn>
        </>
      }
    >
      {submitError && <div className="td-alert td-alert-error">{submitError}</div>}

      <div className="td-field">
        <label className="td-label" htmlFor="tip-title">
          Title
        </label>
        <input
          id="tip-title"
          className="td-input"
          maxLength={100}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          disabled={submitting}
        />
        <div className="td-meta" style={{ marginTop: 6 }}>
          {form.title.length}/100
        </div>
        {errors.title && <p style={fieldErrorStyle()}>{errors.title}</p>}
      </div>

      <div className="td-field">
        <label className="td-label" htmlFor="tip-category">
          Category
        </label>
        <select
          id="tip-category"
          className="td-select"
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
          disabled={submitting}
        >
          {PARENTING_HUB_CATEGORIES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.category && <p style={fieldErrorStyle()}>{errors.category}</p>}
      </div>

      <div className="td-field">
        <label className="td-label" htmlFor="tip-age-range">
          Age range
        </label>
        <select
          id="tip-age-range"
          className="td-select"
          value={form.ageRange}
          onChange={(e) => set('ageRange', e.target.value)}
          disabled={submitting}
        >
          <option value="">Select CDC age range</option>
          {TIP_AGE_RANGE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.ageRange && <p style={fieldErrorStyle()}>{errors.ageRange}</p>}
      </div>

      <div className="td-field">
        <label className="td-label" htmlFor="tip-content">
          Content
        </label>
        <textarea
          id="tip-content"
          className="td-textarea"
          rows={6}
          maxLength={1000}
          value={form.content}
          onChange={(e) => set('content', e.target.value)}
          disabled={submitting}
        />
        <div className="td-meta" style={{ marginTop: 6 }}>
          {form.content.length}/1000
        </div>
        {errors.content && <p style={fieldErrorStyle()}>{errors.content}</p>}
      </div>
    </Modal>
  );
}
