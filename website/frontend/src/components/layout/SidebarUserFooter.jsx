export default function SidebarUserFooter({ name, email, onLogout }) {
  return (
    <div className="app-sidebar__footer">
      {(name || email) && (
        <div className="app-sidebar__user">
          {name ? <div className="app-sidebar__user-name">{name}</div> : null}
          {email ? <div className="app-sidebar__user-email">{email}</div> : null}
        </div>
      )}
      <button type="button" className="app-sidebar__logout" onClick={onLogout}>
        Sign out
      </button>
    </div>
  );
}
