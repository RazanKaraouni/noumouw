import { useEffect, useMemo, useState } from 'react';
import { CDC_MILESTONE_AGE_RANGES } from '../../constants/cdcMilestoneAgeTiers';
import ArticleBodyEditor from './ArticleBodyEditor';
import StorageImagePicker, { IMAGE_ACCEPT } from './StorageImagePicker';
import { API_BASE } from '../../models/httpClient.js';

const tableShell = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  border: '1px solid var(--border)',
  borderRadius: 12,
  overflow: 'hidden',
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
  boxSizing: 'border-box',
};

function richTextHasPlainText(html) {
  if (!html || !String(html).trim()) return false;
  const el = document.createElement('div');
  el.innerHTML = html;
  return Boolean((el.textContent || '').trim());
}

function stripHtml(html) {
  if (!html) return '';
  const el = document.createElement('div');
  el.innerHTML = String(html);
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

const thStyle = {
  padding: '8px 10px',
  color: 'var(--muted)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  fontWeight: 600,
  fontSize: 11,
};

const tdStyle = {
  padding: '8px 10px',
  verticalAlign: 'top',
  borderTop: '1px solid var(--border)',
  wordBreak: 'break-word',
};

function looksLikeVisualMediaUrl(url) {
  if (!url) return false;
  return /\.(jpe?g|png|webp|gif|mp4|mov)(\?|$)/i.test(url);
}

function resolveVideoUrl(resource) {
  return (resource.video_url || '').trim() || (
    resource.content_type === 'video' ? (resource.media_url || '').trim() : ''
  );
}

function resolveImageUrl(resource) {
  return (resource.image_url || '').trim() || (
    resource.content_type === 'image' ? (resource.media_url || '').trim() : ''
  );
}

function resolveAttachmentUrl(resource) {
  const media = (resource.media_url || '').trim();
  if (!media || looksLikeVisualMediaUrl(media)) return '';
  return media;
}

function resourceHasContent(resource, bodyText) {
  return (
    richTextHasPlainText(bodyText) ||
    Boolean(resolveVideoUrl(resource)) ||
    Boolean(resolveImageUrl(resource)) ||
    Boolean(resolveAttachmentUrl(resource))
  );
}

const DOMAIN_FILTER_OPTIONS = [
  { value: 'all', label: 'All domains' },
  { value: 'cognitive', label: 'Cognitive' },
  { value: 'motor', label: 'Motor' },
  { value: 'language', label: 'Language' },
  { value: 'social', label: 'Social' },
  { value: 'autism', label: 'Autism' },
];

const MEDIA_FILTER_OPTIONS = [
  { value: '', label: 'All media' },
  { value: 'video', label: 'Video' },
  { value: 'article', label: 'Article / text' },
  { value: 'image', label: 'Image' },
];

function resourceMatchesSearch(resource, query) {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const bodyPlain = stripHtml(resource.body_text);
  const haystack = [
    resource.title,
    resource.domain,
    resource.age_range,
    bodyPlain,
    resource.publisher,
    resource.content_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

function resourceMatchesMediaFilter(resource, mediaFilter) {
  if (!mediaFilter) return true;
  const videoUrl = resolveVideoUrl(resource);
  const imageUrl = resolveImageUrl(resource);
  const attachmentUrl = resolveAttachmentUrl(resource);
  const hasBody = Boolean(stripHtml(resource.body_text));

  if (mediaFilter === 'video') return Boolean(videoUrl);
  if (mediaFilter === 'image') return Boolean(imageUrl);
  if (mediaFilter === 'article') {
    return Boolean(hasBody || attachmentUrl) && !videoUrl;
  }
  return true;
}

/**
 * @param {{ refreshKey?: number }} props
 */
export default function TherapistResourceInlineTable({ refreshKey = 0 }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', body_text: '' });
  const [replaceVideo, setReplaceVideo] = useState(null);
  const [replaceImage, setReplaceImage] = useState(null);
  const [replaceAttachment, setReplaceAttachment] = useState(null);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleting, setDeleting] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadResources = async () => {
    const token = window.sessionStorage.getItem('noumouw_token');
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => []);
      if (res.ok) {
        setResources(Array.isArray(data) ? data : []);
        setLoadError('');
      } else {
        setLoadError(data?.message || `Failed to load (${res.status}).`);
      }
    } catch {
      setLoadError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [refreshKey]);

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (domainFilter && (r.domain || '') !== domainFilter) return false;
      if (ageFilter && (r.age_range || '') !== ageFilter) return false;
      if (!resourceMatchesMediaFilter(r, mediaFilter)) return false;
      if (!resourceMatchesSearch(r, searchQuery)) return false;
      return true;
    });
  }, [resources, searchQuery, domainFilter, ageFilter, mediaFilter]);

  const openEdit = (r) => {
    setEditing(r);
    setForm({ title: r.title || '', body_text: r.body_text || '' });
    setReplaceVideo(null);
    setReplaceImage(null);
    setReplaceAttachment(null);
    setEditError('');
  };

  const closeEdit = () => {
    if (editSubmitting) return;
    setEditing(null);
    setReplaceVideo(null);
    setReplaceImage(null);
    setReplaceAttachment(null);
    setEditError('');
  };

  const validateEdit = () => {
    if (!form.title.trim()) return 'Title is required.';
    if (editing && !resourceHasContent(editing, form.body_text) && !replaceVideo && !replaceImage && !replaceAttachment) {
      return 'Add body text, a document, a video, or an image.';
    }
    return '';
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    const v = validateEdit();
    if (v) {
      setEditError(v);
      return;
    }
    const token = window.sessionStorage.getItem('noumouw_token');
    if (!token) {
      setEditError('You are not signed in.');
      return;
    }

    setEditSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('body_text', (form.body_text || '').trim());
      if (replaceAttachment) fd.append('attachment', replaceAttachment);
      if (replaceVideo) fd.append('video', replaceVideo);
      if (replaceImage) fd.append('image', replaceImage);

      const res = await fetch(`${API_BASE}/api/resources/${editing.resources_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data.message || `Update failed (${res.status})`);
        return;
      }
      setEditing(null);
      setReplaceVideo(null);
      setReplaceImage(null);
      setReplaceAttachment(null);
      await loadResources();
    } catch {
      setEditError('Network error.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitDelete = async () => {
    if (!deleting) return;
    const token = window.sessionStorage.getItem('noumouw_token');
    if (!token) {
      setDeleteError('You are not signed in.');
      return;
    }
    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API_BASE}/api/resources/${deleting.resources_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.message || `Delete failed (${res.status})`);
        return;
      }
      setDeleting(null);
      await loadResources();
    } catch {
      setDeleteError('Network error.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 20,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, flexShrink: 0 }}>
        Your resources
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16, flexShrink: 0 }}>
        Refreshes when you upload. Search and filter below, or edit and delete rows.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search title, content, or domain…"
          style={{ ...inputStyle, flex: '2 1 200px', minWidth: 180 }}
        />
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 140px', minWidth: 130 }}
          aria-label="Filter by domain"
        >
          <option value="">All domains</option>
          {DOMAIN_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={ageFilter}
          onChange={(e) => setAgeFilter(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 140px', minWidth: 130 }}
          aria-label="Filter by age"
        >
          <option value="">All ages</option>
          <option value="all">All ages (tag)</option>
          {CDC_MILESTONE_AGE_RANGES.map((opt) => (
            <option key={opt.label} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={mediaFilter}
          onChange={(e) => setMediaFilter(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 120px', minWidth: 110 }}
          aria-label="Filter by media type"
        >
          {MEDIA_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {(searchQuery || domainFilter || ageFilter || mediaFilter) && (
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12, flexShrink: 0 }}>
          {filteredResources.length} of {resources.length} resources
        </p>
      )}

      {loadError && (
        <div
          style={{
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 12,
            color: 'var(--danger)',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {loadError}
        </div>
      )}

      <div style={{ overflow: 'auto', flex: 1, minHeight: 120 }}>
        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
            Loading...
          </p>
        ) : resources.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing uploaded yet.</p>
        ) : filteredResources.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>No resources match your search or filters.</p>
        ) : (
          <table style={tableShell}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Domain</th>
                <th style={thStyle}>Age</th>
                <th style={thStyle}>Preview</th>
                <th style={thStyle}>Media</th>
                <th style={thStyle}>Added</th>
                <th style={{ ...thStyle, width: 132 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.map((r) => {
                const bodyPlain = stripHtml(r.body_text);
                const preview =
                  bodyPlain.length > 100 ? `${bodyPlain.slice(0, 100)}…` : bodyPlain || '—';
                const videoUrl = resolveVideoUrl(r);
                const imageUrl = resolveImageUrl(r);
                const attachmentUrl = resolveAttachmentUrl(r);
                return (
                  <tr key={r.resources_id}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{r.title}</td>
                    <td style={tdStyle}>{r.domain || '—'}</td>
                    <td style={tdStyle}>{r.age_range || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--muted)', maxWidth: 160 }} title={bodyPlain}>
                      {preview}
                      {attachmentUrl && (
                        <div style={{ marginTop: 4 }}>
                          <a
                            href={attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', fontSize: 11 }}
                          >
                            Download file
                          </a>
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 120 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {videoUrl ? (
                          <a
                            href={videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', fontSize: 11 }}
                          >
                            Video
                          </a>
                        ) : null}
                        {imageUrl ? (
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', fontSize: 11 }}
                          >
                            Image
                          </a>
                        ) : null}
                        {!videoUrl && !imageUrl ? '—' : null}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            padding: '3px 8px',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontFamily: 'var(--font)',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleting(r);
                            setDeleteError('');
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            padding: '3px 8px',
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontFamily: 'var(--font)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--danger)';
                            e.currentTarget.style.color = 'var(--danger)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--muted)';
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title="Edit resource" onClose={closeEdit}>
          <form onSubmit={submitEdit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  Title <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  style={inputStyle}
                />
              </div>

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
                  Body <span style={{ color: 'var(--muted)' }}>(optional)</span>
                </label>
                <ArticleBodyEditor
                  value={form.body_text}
                  onChange={(html) => setForm((p) => ({ ...p, body_text: html }))}
                  attachmentFile={replaceAttachment}
                  onAttachmentChange={setReplaceAttachment}
                  existingAttachmentUrl={
                    replaceAttachment ? null : resolveAttachmentUrl(editing) || null
                  }
                />
              </div>

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
                  Video <span style={{ color: 'var(--muted)' }}>(optional)</span>
                </label>
                <StorageImagePicker
                  file={replaceVideo}
                  onChange={setReplaceVideo}
                  accept=".mp4,.mov,video/mp4,video/quicktime"
                  buttonLabel="Replace video"
                  existingUrl={replaceVideo ? null : resolveVideoUrl(editing) || null}
                  disabled={editSubmitting}
                />
              </div>

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
                  Image <span style={{ color: 'var(--muted)' }}>(optional)</span>
                </label>
                <StorageImagePicker
                  file={replaceImage}
                  onChange={setReplaceImage}
                  accept={IMAGE_ACCEPT}
                  buttonLabel="Replace image"
                  existingUrl={replaceImage ? null : resolveImageUrl(editing) || null}
                  disabled={editSubmitting}
                />
              </div>
            </div>

            {editError && (
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
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                type="button"
                onClick={closeEdit}
                disabled={editSubmitting}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  cursor: editSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 10,
                  background: editSubmitting ? 'var(--surface2)' : 'var(--accent)',
                  border: 'none',
                  color: editSubmitting ? 'var(--muted)' : 'var(--text-on-accent)',
                  fontWeight: 600,
                  cursor: editSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)',
                  fontSize: 14,
                }}
              >
                {editSubmitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Delete resource"
          onClose={() => {
            if (!deleteSubmitting) {
              setDeleting(null);
              setDeleteError('');
            }
          }}
        >
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text)' }}>{deleting.title || 'this resource'}</strong>?
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
            This will permanently remove the resource and any uploaded files. This cannot be undone.
          </p>

          {deleteError && (
            <div
              style={{
                marginBottom: 16,
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--danger)',
                fontSize: 13,
              }}
            >
              {deleteError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (!deleteSubmitting) {
                  setDeleting(null);
                  setDeleteError('');
                }
              }}
              disabled={deleteSubmitting}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                cursor: deleteSubmitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitDelete}
              disabled={deleteSubmitting}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                background: 'var(--danger)',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                cursor: deleteSubmitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              {deleteSubmitting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="td-resource-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="td-resource-modal-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="td-resource-modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}