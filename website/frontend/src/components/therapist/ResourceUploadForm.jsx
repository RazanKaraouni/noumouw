import { useState } from 'react';
import { CDC_MILESTONE_AGE_RANGES } from '../../constants/cdcMilestoneAgeTiers';
import ArticleBodyEditor from './ArticleBodyEditor';
import StorageImagePicker, { IMAGE_ACCEPT } from './StorageImagePicker';
import TherapistResourceInlineTable from './TherapistResourceInlineTable';
import { API_BASE } from '../../models/httpClient.js';

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font)',
  outline: 'none',
  boxSizing: 'border-box',
};

const DOMAIN_OPTIONS = [
  { value: 'cognitive', label: 'Cognitive' },
  { value: 'motor', label: 'Motor' },
  { value: 'language', label: 'Language' },
  { value: 'social', label: 'Social' },
  { value: 'autism', label: 'Autism' },
];

const AGE_OPTIONS = CDC_MILESTONE_AGE_RANGES.map((r) => ({
  value: r.label,
  label: r.label,
}));

function richTextHasPlainText(html) {
  if (!html || !String(html).trim()) return false;
  const el = document.createElement('div');
  el.innerHTML = html;
  return Boolean((el.textContent || '').trim());
}

const addBtnStyle = {
  padding: '10px 20px',
  borderRadius: 10,
  background: 'var(--accent-gradient, var(--accent))',
  border: 'none',
  color: 'var(--text-on-accent)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  whiteSpace: 'nowrap',
};

export default function ResourceUploadForm() {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [articleAttachment, setArticleAttachment] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  const openForm = () => {
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setError('');
    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDomain('');
    setAgeRange('');
    setBodyText('');
    setArticleAttachment(null);
    setVideoFile(null);
    setImageFile(null);
  };

  const validate = () => {
    if (!title.trim()) return 'Title is required.';
    if (!domain) return 'Please choose a domain.';
    if (!ageRange) return 'Please choose an age range.';
    const hasBody = richTextHasPlainText(bodyText);
    const hasMedia = Boolean(videoFile || imageFile || articleAttachment);
    if (!hasBody && !hasMedia) {
      return 'Add body text, a document, a video, or an image.';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    const token = window.sessionStorage.getItem('noumouw_token');
    if (!token) {
      setError('You are not signed in.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('domain', domain);
      fd.append('age_range', ageRange);
      fd.append('content_type', 'resource');
      if (bodyText.trim()) fd.append('body_text', bodyText.trim());
      if (articleAttachment) fd.append('attachment', articleAttachment);
      if (videoFile) fd.append('video', videoFile);
      if (imageFile) fd.append('image', imageFile);

      const res = await fetch(`${API_BASE}/api/resources`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || `Request failed (${res.status})`);
        return;
      }

      setMessage('Resource saved successfully.');
      resetForm();
      setShowForm(false);
      setTableRefreshKey((k) => k + 1);
    } catch {
      setError('Network error.');
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
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Your resources</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            Browse, edit, and delete your library. Upload a new resource when you are ready.
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={openForm} style={addBtnStyle}>
            + Upload resource
          </button>
        )}
      </div>

      {message && (
        <div
          style={{
            background: 'rgba(var(--green-rgb),0.1)',
            border: '1px solid rgba(var(--green-rgb),0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            color: 'var(--accent)',
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      {showForm && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>New resource</h2>
            <button
              type="button"
              onClick={closeForm}
              disabled={submitting}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                fontSize: 13,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Cancel
            </button>
          </div>

          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
            Add text, an optional document, and optional video and image. At least one of these is
            required.
          </p>

          {error && (
            <div
              style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                color: 'var(--danger)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              maxWidth: 720,
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 28,
              marginBottom: 32,
            }}
          >
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Title <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resource title"
            required
            style={inputStyle}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Choose domain <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select domain</option>
              <option value="all">All domains</option>
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Choose age <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select age range</option>
              <option value="all">All ages</option>
              {AGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Body <span style={{ color: 'var(--muted)' }}>(optional)</span>
          </label>
          <ArticleBodyEditor
            value={bodyText}
            onChange={setBodyText}
            attachmentFile={articleAttachment}
            onAttachmentChange={setArticleAttachment}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 18,
            alignItems: 'start',
          }}
        >
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Video <span style={{ color: 'var(--muted)' }}>(optional)</span>
            </label>
            <StorageImagePicker
              file={videoFile}
              onChange={setVideoFile}
              accept=".mp4,.mov,video/mp4,video/quicktime"
              buttonLabel="Upload video"
              disabled={submitting}
              hint="MP4 or MOV, up to 100 MB"
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Image <span style={{ color: 'var(--muted)' }}>(optional)</span>
            </label>
            <StorageImagePicker
              file={imageFile}
              onChange={setImageFile}
              accept={IMAGE_ACCEPT}
              buttonLabel="Upload image"
              disabled={submitting}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 8,
            padding: '12px 20px',
            borderRadius: 10,
            background: submitting ? 'var(--surface2)' : 'var(--accent)',
            border: 'none',
            color: submitting ? 'var(--muted)' : 'var(--text-on-accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          {submitting ? 'Saving…' : 'Save resource'}
        </button>
      </form>
        </>
      )}

      <TherapistResourceInlineTable refreshKey={tableRefreshKey} />
    </div>
  );
}