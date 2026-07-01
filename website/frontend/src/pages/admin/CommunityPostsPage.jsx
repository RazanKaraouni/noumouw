import { getUserFacingError } from '../../utils/errorFeedback.js';
import { clampDateNotAfterToday, todayDateInputValue } from '../../utils/dateInput.js';
import { useCallback, useEffect, useState } from 'react';
import { adminModel } from '../../models/adminModel.js';
import {
  AdminAlert,
  AdminModal,
  DialogButton,
  DialogFooter,
} from '../../components/admin/ui';

const CATEGORY_LABELS = {
  speech_language: 'Speech & Language',
  gross_motor: 'Gross Motor Skills',
  sensory_autism: 'Sensory/Autism Support',
  feeding_sleep: 'Feeding & Sleep',
};

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  color: 'var(--muted)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const tdStyle = {
  padding: '12px 16px',
  verticalAlign: 'top',
};

const selectStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font)',
};

const inputStyle = { ...selectStyle, minWidth: 140 };

function formatDate(raw) {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function CommunityPostsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    developmental_categories: [],
    age_categories: [],
  });

  const [devCategory, setDevCategory] = useState('');
  const [ageCategory, setAgeCategory] = useState('');
  const [anonFilter, setAnonFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [viewPostId, setViewPostId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deletePostTarget, setDeletePostTarget] = useState(null);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null);
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnReason, setWarnReason] = useState('');
  const [suspendTarget, setSuspendTarget] = useState(null);

  const buildParams = useCallback(() => {
    const params = {};
    if (devCategory) params.developmental_category = devCategory;
    if (ageCategory) params.age_category = ageCategory;
    if (anonFilter === 'true' || anonFilter === 'false') params.is_anonymous = anonFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return params;
  }, [devCategory, ageCategory, anonFilter, dateFrom, dateTo]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminModel.community.listPosts(buildParams());
      setPosts(data.posts || []);
      if (data.filterOptions) setFilterOptions(data.filterOptions);
    } catch (err) {
      setPosts([]);
      setError(getUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const openView = async (post) => {
    setViewPostId(post.post_id);
    setDetail(null);
    setDetailLoading(true);
    setActionError('');
    try {
      const { data } = await adminModel.community.getPost(post.post_id);
      setDetail(data);
    } catch (err) {
      setActionError(getUserFacingError(err));
      setViewPostId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (postId) => {
    const { data } = await adminModel.community.getPost(postId);
    setDetail(data);
    await loadPosts();
  };

  const handleDeletePost = async () => {
    if (!deletePostTarget) return;
    setSubmitting(true);
    setActionError('');
    try {
      await adminModel.community.deletePost(deletePostTarget.post_id);
      setDeletePostTarget(null);
      if (viewPostId === deletePostTarget.post_id) {
        setViewPostId(null);
        setDetail(null);
      }
      await loadPosts();
    } catch (err) {
      setActionError(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!deleteCommentTarget || !viewPostId) return;
    setSubmitting(true);
    setActionError('');
    try {
      await adminModel.community.deleteComment(deleteCommentTarget.comment_id);
      setDeleteCommentTarget(null);
      await refreshDetail(viewPostId);
    } catch (err) {
      setActionError(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWarn = async () => {
    if (!warnTarget?.user_id) return;
    const reason = warnReason.trim();
    if (!reason) {
      setActionError('Warning reason is required.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      await adminModel.community.warnUser(warnTarget.user_id, { reason });
      setWarnTarget(null);
      setWarnReason('');
    } catch (err) {
      setActionError(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget?.user_id) return;
    setSubmitting(true);
    setActionError('');
    try {
      await adminModel.community.suspendUser(suspendTarget.user_id);
      setSuspendTarget(null);
      await loadPosts();
    } catch (err) {
      setActionError(getUserFacingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const devCategories =
    filterOptions.developmental_categories?.length > 0
      ? filterOptions.developmental_categories
      : Object.keys(CATEGORY_LABELS);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>
          Community Posts
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          Moderate community discussions
          {loading ? '' : ` · ${posts.length} post${posts.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
          alignItems: 'flex-end',
        }}
      >
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>
          Category
          <select
            value={devCategory}
            onChange={(e) => setDevCategory(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: 6, minWidth: 160 }}
          >
            <option value="">All categories</option>
            {devCategories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>
          Age group
          <select
            value={ageCategory}
            onChange={(e) => setAgeCategory(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: 6 }}
          >
            <option value="">All ages</option>
            {(filterOptions.age_categories || []).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>
          Anonymous
          <select
            value={anonFilter}
            onChange={(e) => setAnonFilter(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: 6 }}
          >
            <option value="">All</option>
            <option value="true">Anonymous only</option>
            <option value="false">Named only</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>
          From
          <input
            type="date"
            value={dateFrom}
            max={todayDateInputValue()}
            onChange={(e) => setDateFrom(clampDateNotAfterToday(e.target.value))}
            style={{ ...inputStyle, display: 'block', marginTop: 6 }}
          />
        </label>
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>
          To
          <input
            type="date"
            value={dateTo}
            max={todayDateInputValue()}
            onChange={(e) => setDateTo(clampDateNotAfterToday(e.target.value))}
            style={{ ...inputStyle, display: 'block', marginTop: 6 }}
          />
        </label>
        <button
          type="button"
          onClick={loadPosts}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          Apply filters
        </button>
      </div>

      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {actionError && !viewPostId && !deletePostTarget && !deleteCommentTarget && !warnTarget && !suspendTarget ? (
        <AdminAlert>{actionError}</AdminAlert>
      ) : null}

      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1100 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {[
                'Author',
                'Content preview',
                'Category',
                'Age group',
                'Likes',
                'Comments',
                'Date',
                'Anonymous',
                'Actions',
              ].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, color: 'var(--muted)' }}>
                  Loading posts…
                </td>
              </tr>
            )}
            {!loading && posts.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, color: 'var(--muted)', padding: 48 }}>
                  No posts match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              posts.map((post) => (
                <tr key={post.post_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {post.author_name}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 280, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {post.content_preview || '—'}
                  </td>
                  <td style={tdStyle}>{post.category_label || '—'}</td>
                  <td style={tdStyle}>{post.age_group_label || post.age_category || '—'}</td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {post.likes_count ?? 0}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {post.comments_count ?? 0}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(post.created_at)}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: post.is_anonymous
                          ? 'rgba(148,163,184,0.15)'
                          : 'rgba(var(--green-rgb),0.12)',
                        color: post.is_anonymous ? '#94a3b8' : 'var(--accent)',
                      }}
                    >
                      {post.is_anonymous ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <ActionBtn label="View" onClick={() => openView(post)} />
                      <ActionBtn
                        label="Delete post"
                        variant="danger"
                        onClick={() => setDeletePostTarget(post)}
                      />
                      {post.user_id && (
                        <>
                          <ActionBtn
                            label="Warn"
                            variant="warn"
                            onClick={() => {
                              setWarnReason('');
                              setWarnTarget({
                                user_id: post.user_id,
                                label: post.moderation_author_name || post.author_name,
                              });
                            }}
                          />
                          <ActionBtn
                            label="Suspend"
                            variant="danger"
                            onClick={() =>
                              setSuspendTarget({
                                user_id: post.user_id,
                                label: post.moderation_author_name || post.author_name,
                              })
                            }
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {viewPostId && (
        <AdminModal
          title="Full post"
          size="wide"
          onClose={() => {
            setViewPostId(null);
            setDetail(null);
            setActionError('');
          }}
        >
          {detailLoading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
          {actionError && detailLoading === false && !detail && (
            <p style={{ color: 'var(--danger)' }}>{actionError}</p>
          )}
          {detail?.post && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  {detail.post.author_name} · {detail.post.category_label} ·{' '}
                  {detail.post.age_group_label} · {formatDate(detail.post.created_at)}
                  {detail.post.is_anonymous && (
                    <span style={{ marginLeft: 8, color: '#94a3b8' }}>(anonymous post)</span>
                  )}
                </div>
                <p style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {detail.post.content}
                </p>
                {detail.post.image_url && (
                  <img
                    src={detail.post.image_url}
                    alt=""
                    style={{
                      marginTop: 16,
                      maxWidth: '100%',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}
                  />
                )}
                {detail.post.user_id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <ActionBtn
                      label="Warn author"
                      variant="warn"
                      onClick={() => {
                        setWarnReason('');
                        setWarnTarget({
                          user_id: detail.post.user_id,
                          label: detail.post.moderation_author_name || detail.post.author_name,
                        });
                      }}
                    />
                    <ActionBtn
                      label="Suspend author"
                      variant="danger"
                      onClick={() =>
                        setSuspendTarget({
                          user_id: detail.post.user_id,
                          label: detail.post.moderation_author_name || detail.post.author_name,
                        })
                      }
                    />
                    <ActionBtn
                      label="Delete post"
                      variant="danger"
                      onClick={() => setDeletePostTarget(detail.post)}
                    />
                  </div>
                )}
              </div>

              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                Comments ({detail.comments?.length || 0})
              </h3>
              {detail.comments?.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>No comments on this post.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detail.comments.map((c) => (
                    <div
                      key={c.comment_id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--surface2)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginBottom: 6,
                          fontSize: 12,
                          color: 'var(--muted)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {c.author_name}
                        </span>
                        <span>{formatDate(c.created_at)}</span>
                      </div>
                      <p style={{ margin: '0 0 8px', lineHeight: 1.5, fontSize: 13 }}>
                        {c.content || c.comment_text}
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <ActionBtn
                          label="Delete comment"
                          variant="danger"
                          onClick={() => setDeleteCommentTarget(c)}
                        />
                        {c.user_id && (
                          <>
                            <ActionBtn
                              label="Warn"
                              variant="warn"
                              onClick={() => {
                                setWarnReason('');
                                setWarnTarget({
                                  user_id: c.user_id,
                                  label: c.author_name,
                                });
                              }}
                            />
                            <ActionBtn
                              label="Suspend"
                              variant="danger"
                              onClick={() =>
                                setSuspendTarget({
                                  user_id: c.user_id,
                                  label: c.author_name,
                                })
                              }
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </AdminModal>
      )}

      {deletePostTarget && (
        <AdminModal title="Delete post" onClose={() => !submitting && setDeletePostTarget(null)}>
          <p className="confirm-dialog-message" style={{ marginTop: 0 }}>
            Delete this post by {deletePostTarget.author_name || 'the author'}? All comments and
            likes will be removed. This cannot be undone.
          </p>
          <DialogFooter>
            <DialogButton onClick={() => setDeletePostTarget(null)}>Cancel</DialogButton>
            <DialogButton variant="danger" disabled={submitting} onClick={handleDeletePost}>
              {submitting ? 'Deleting…' : 'Delete post'}
            </DialogButton>
          </DialogFooter>
        </AdminModal>
      )}

      {deleteCommentTarget && (
        <AdminModal title="Delete comment" onClose={() => !submitting && setDeleteCommentTarget(null)}>
          <p className="confirm-dialog-message" style={{ marginTop: 0 }}>
            Remove this comment permanently?
          </p>
          <DialogFooter>
            <DialogButton onClick={() => setDeleteCommentTarget(null)}>Cancel</DialogButton>
            <DialogButton variant="danger" disabled={submitting} onClick={handleDeleteComment}>
              {submitting ? 'Deleting…' : 'Delete comment'}
            </DialogButton>
          </DialogFooter>
        </AdminModal>
      )}

      {warnTarget && (
        <AdminModal title="Warn user" onClose={() => !submitting && (setWarnTarget(null), setWarnReason(''))}>
          <p className="confirm-dialog-message" style={{ marginTop: 0 }}>
            Record a warning for <strong className="text-[var(--text)]">{warnTarget.label}</strong>. This will be stored in their moderation history.
          </p>
          <textarea
            rows={4}
            value={warnReason}
            onChange={(e) => setWarnReason(e.target.value)}
            placeholder="Describe the policy violation…"
            className="admin-input"
            style={{ marginTop: 12, marginBottom: 12, resize: 'vertical' }}
          />
          {actionError ? <AdminAlert>{actionError}</AdminAlert> : null}
          <DialogFooter>
            <DialogButton
              onClick={() => {
                setWarnTarget(null);
                setWarnReason('');
              }}
            >
              Cancel
            </DialogButton>
            <DialogButton
              variant="warning"
              disabled={submitting || !warnReason.trim()}
              onClick={handleWarn}
            >
              {submitting ? 'Saving…' : 'Send warning'}
            </DialogButton>
          </DialogFooter>
        </AdminModal>
      )}

      {suspendTarget && (
        <AdminModal
          title="Suspend user"
          onClose={() => !submitting && setSuspendTarget(null)}
        >
          <p className="confirm-dialog-message" style={{ marginTop: 0 }}>
            Suspend <strong className="text-[var(--text)]">{suspendTarget.label}</strong>&apos;s parent account? They will not be able to use parent features until reactivated.
          </p>
          <DialogFooter>
            <DialogButton onClick={() => setSuspendTarget(null)}>Cancel</DialogButton>
            <DialogButton variant="warning" disabled={submitting} onClick={handleSuspend}>
              {submitting ? 'Suspending…' : 'Suspend user'}
            </DialogButton>
          </DialogFooter>
        </AdminModal>
      )}
    </div>
  );
}

function ActionBtn({ label, onClick, variant }) {
  const colors =
    variant === 'danger'
      ? { border: 'rgba(248,113,113,0.45)', color: 'var(--danger)' }
      : variant === 'warn'
        ? { border: 'rgba(251,191,36,0.45)', color: '#fbbf24' }
        : { border: 'var(--border)', color: 'var(--accent)' };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: 6,
        border: `1px solid ${colors.border}`,
        background: 'transparent',
        color: colors.color,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
