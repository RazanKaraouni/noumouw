import { useState } from 'react';
import { Modal, Btn } from './ui/TherapistUI';

const DOMAINS = ['speech', 'cognitive', 'motor', 'social'];
const PRIORITIES = ['low', 'medium', 'high'];

const empty = () => ({
  title: '',
  description: '',
  domain: 'speech',
  priority: 'medium',
  due_date: '',
});

export default function AssignmentFormModal({ open, onClose, onSubmit, initial, title: modalTitle }) {
  const [form, setForm] = useState(initial || empty());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setErr('Title is required.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim() || null,
        domain: form.domain,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      setForm(empty());
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not save assignment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={modalTitle || 'Add assignment'}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Btn>
        </>
      }
    >
      {err && <div className="td-alert td-alert-error">{err}</div>}
      <div className="td-field">
        <label className="td-label" htmlFor="asg-title">Title</label>
        <input id="asg-title" className="td-input" value={form.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="td-field">
        <label className="td-label" htmlFor="asg-desc">Description</label>
        <textarea id="asg-desc" className="td-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="td-field">
        <label className="td-label" htmlFor="asg-domain">Domain</label>
        <select id="asg-domain" className="td-select" value={form.domain} onChange={(e) => set('domain', e.target.value)}>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="td-field">
        <label className="td-label" htmlFor="asg-priority">Priority</label>
        <select id="asg-priority" className="td-select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="td-field">
        <label className="td-label" htmlFor="asg-due">Due date</label>
        <input id="asg-due" type="date" className="td-input" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
      </div>
    </Modal>
  );
}

