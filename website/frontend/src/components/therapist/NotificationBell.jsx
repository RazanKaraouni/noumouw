import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from './ui/TherapistUI';
import { getTherapistSocket } from '../../lib/therapistSocket';
import { therapistApi } from '../../lib/therapistApi';
import { formatNotificationTime } from '../../utils/formatNotificationTime';

const TYPE_META = {
  APPOINTMENT_REQUEST: {
    label: 'Appointment',
    tone: 'info',
    icon: '📅',
    previewPrefix: 'New appointment request from',
  },
  ASSIGNMENT_DONE: {
    label: 'Completed',
    tone: 'success',
    icon: '✓',
    previewPrefix: 'Assignment completed by',
  },
  ASSIGNMENT_NOTE: {
    label: 'Note',
    tone: 'warning',
    icon: '📝',
    previewPrefix: 'New note on assignment',
  },
  NEW_MESSAGE: {
    label: 'Message',
    tone: 'default',
    icon: '💬',
    previewPrefix: 'New message from',
  },
  RESOURCE_LIKE: {
    label: 'Like',
    tone: 'success',
    icon: '❤️',
    previewPrefix: 'A parent liked your',
  },
  MODERATION_WARNING: {
    label: 'Warning',
    tone: 'warning',
    icon: '⚠️',
    previewPrefix: 'Moderation warning',
  },
  MODERATION_SUSPENSION: {
    label: 'Suspended',
    tone: 'danger',
    icon: '🚫',
    previewPrefix: 'Account suspended',
  },
};

function normalizeNotification(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id || raw.notification_id;
  if (!id) return null;
  return {
    id: String(id),
    recipientId: raw.recipientId || raw.recipient_id || null,
    senderId: raw.senderId || raw.sender_id || null,
    type: raw.type || 'NEW_MESSAGE',
    title: raw.title || '',
    message: raw.message || raw.body || '',
    isRead: Boolean(raw.isRead ?? raw.is_read),
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
  };
}

function displayText(notification) {
  const meta = TYPE_META[notification.type] || TYPE_META.NEW_MESSAGE;
  const body = (notification.message || notification.title || '').trim();
  if (!body) return meta.previewPrefix;
  if (notification.type === 'NEW_MESSAGE' && body.includes(':')) {
    const [name, ...rest] = body.split(':');
    return `${meta.previewPrefix} ${name.trim()}${rest.length ? `: ${rest.join(':').trim()}` : ''}`;
  }
  if (notification.type === 'APPOINTMENT_REQUEST' && !body.toLowerCase().startsWith('new appointment')) {
    const name = body.split(' requested')[0]?.trim();
    if (name) return `${meta.previewPrefix} ${name}`;
  }
  if (notification.type === 'ASSIGNMENT_DONE' && body.toLowerCase().includes('marked')) {
    return body.replace(/^a parent/i, 'Assignment completed by a parent');
  }
  if (notification.type === 'RESOURCE_LIKE' && body.toLowerCase().includes('liked your')) {
    return body;
  }
  if (notification.type === 'ASSIGNMENT_NOTE' && body.toLowerCase().startsWith('note on')) {
    return `New note on assignment — ${body.replace(/^note on\s*/i, '')}`;
  }
  return body;
}

function Toast({ message, visible }) {
  if (!visible || !message) return null;
  return (
    <div className="td-notification-toast" role="status" aria-live="polite">
      <span className="td-notification-toast-icon" aria-hidden>
        🔔
      </span>
      <span>{message}</span>
    </div>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const rootRef = useRef(null);
  const toastTimerRef = useRef(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const showToast = useCallback((message) => {
    setToast(message);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setToast('');
    }, 4200);
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoadError('');
    try {
      const rows = await therapistApi.notifications.list();
      setNotifications(
        (Array.isArray(rows) ? rows : [])
          .map(normalizeNotification)
          .filter(Boolean),
      );
    } catch (err) {
      setLoadError(getUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const socket = getTherapistSocket();
    if (!socket) return undefined;

    const onNewNotification = (payload) => {
      const item = normalizeNotification(payload);
      if (!item) return;

      setNotifications((prev) => {
        if (prev.some((n) => n.id === item.id)) return prev;
        return [item, ...prev];
      });

      if (!openRef.current) {
        showToast(displayText(item));
      }
    };

    socket.on('new_notification', onNewNotification);
    return () => {
      socket.off('new_notification', onNewNotification);
    };
  }, [showToast]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const markAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await therapistApi.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      showToast(getUserFacingError(err));
    } finally {
      setMarkingAll(false);
    }
  };

  const markOneRead = async (notification) => {
    if (notification.isRead) return;
    try {
      await therapistApi.notifications.markRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      showToast(getUserFacingError(err));
    }
  };

  return (
    <>
      <Toast message={toast} visible={toastVisible} />
      <div className="td-notification-bell-wrap" ref={rootRef}>
        <button
          type="button"
          className="td-notification-bell-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          aria-expanded={open}
          aria-haspopup="true"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="td-notification-badge" aria-hidden>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="td-notification-panel" role="menu">
            <div className="td-notification-panel-head">
              <h3 className="td-notification-panel-title">Notifications</h3>
              <button
                type="button"
                className="td-notification-mark-all"
                onClick={markAllRead}
                disabled={markingAll || unreadCount === 0}
              >
                {markingAll ? 'Updating…' : 'Mark all as read'}
              </button>
            </div>

            <div className="td-notification-list">
              {loading && (
                <p className="td-notification-empty">Loading notifications…</p>
              )}
              {!loading && loadError && (
                <p className="td-notification-empty td-notification-error">{loadError}</p>
              )}
              {!loading && !loadError && notifications.length === 0 && (
                <p className="td-notification-empty">No notifications yet.</p>
              )}
              {!loading &&
                !loadError &&
                notifications.map((notification) => {
                  const meta = TYPE_META[notification.type] || TYPE_META.NEW_MESSAGE;
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      className={`td-notification-item${notification.isRead ? '' : ' td-notification-item-unread'}`}
                      onClick={() => markOneRead(notification)}
                    >
                      <div className="td-notification-item-top">
                        <span className="td-notification-type-icon" aria-hidden>
                          {meta.icon}
                        </span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="td-notification-time">
                          {formatNotificationTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="td-notification-item-text">
                        {displayText(notification)}
                      </p>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
