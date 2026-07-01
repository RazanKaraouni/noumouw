import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSeenReportIds, saveSeenReportIds } from '../../utils/seenReportIds.js';

function formatWhen(raw) {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function toLabelCase(input) {
  const s = String(input || '').trim();
  if (!s) return 'Report';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ReportNotificationBell({ reports = [] }) {
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState(loadSeenReportIds);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const newReports = useMemo(
    () => (reports || []).filter((r) => r.report_id && !seenIds.has(r.report_id)),
    [reports, seenIds],
  );

  const newCount = newReports.length;

  const markAllSeen = useCallback(() => {
    const next = new Set(seenIds);
    (reports || []).forEach((r) => {
      if (r.report_id) next.add(r.report_id);
    });
    saveSeenReportIds(next);
    setSeenIds(next);
  }, [reports, seenIds]);

  const markOneSeen = useCallback(
    (reportId) => {
      if (!reportId || seenIds.has(reportId)) return;
      const next = new Set(seenIds);
      next.add(reportId);
      saveSeenReportIds(next);
      setSeenIds(next);
    },
    [seenIds],
  );

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      const panel = panelRef.current;
      const button = buttonRef.current;
      if (!panel || !button) return;
      if (panel.contains(event.target) || button.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const moderationLink = (report) =>
    `/moderation-queue?status=pending&report_id=${encodeURIComponent(report.report_id)}${
      report.target_type ? `&target_type=${encodeURIComponent(report.target_type)}` : ''
    }`;

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={
          newCount > 0
            ? `${newCount} new report${newCount === 1 ? '' : 's'} awaiting review`
            : 'No new reports'
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: open ? 'rgba(var(--green-rgb),0.08)' : 'var(--surface2)',
          color: newCount > 0 ? 'var(--text)' : 'var(--muted)',
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={20}
          height={20}
          stroke="currentColor"
          fill="none"
          strokeWidth={2}
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {newCount > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              borderRadius: 999,
              background: '#ef4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--bg)',
              lineHeight: 1,
            }}
          >
            +{newCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="New report notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxWidth: 'min(360px, calc(100vw - 48px))',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Report alerts</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {newCount > 0
                  ? `${newCount} new request${newCount === 1 ? '' : 's'} awaiting review`
                  : 'You are caught up'}
              </div>
            </div>
            {newCount > 0 ? (
              <button
                type="button"
                onClick={markAllSeen}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {newCount === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--muted)' }}>
                No new flagged reports. Pending items still appear in the moderation queue below.
              </div>
            ) : (
              newReports.map((report) => (
                <Link
                  key={report.report_id}
                  to={moderationLink(report)}
                  onClick={() => {
                    markOneSeen(report.report_id);
                    setOpen(false);
                  }}
                  style={{
                    display: 'block',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: '#ef4444',
                      }}
                    >
                      New
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {formatWhen(report.created_at)}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}>
                    {toLabelCase(report.target_type)} report
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: 'var(--muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {report.reason || 'Flagged content requires review.'}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <Link
              to="/moderation-queue?status=pending"
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              Open moderation queue →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
