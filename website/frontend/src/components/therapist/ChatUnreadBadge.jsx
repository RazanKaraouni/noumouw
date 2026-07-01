export default function ChatUnreadBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className="td-notification-badge" aria-hidden>
      {count > 99 ? '99+' : count}
    </span>
  );
}
