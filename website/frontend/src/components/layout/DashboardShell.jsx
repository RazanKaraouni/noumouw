import { Menu, X } from 'lucide-react';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext.jsx';

function DashboardShellInner({ sidebar, topBar, children, contentClassName = '' }) {
  const { isOpen, closeSidebar, toggleSidebar } = useSidebar();

  return (
    <div className="dashboard-shell">
      <button
        type="button"
        className={`sidebar-backdrop${isOpen ? ' is-visible' : ''}`}
        aria-label="Close menu"
        tabIndex={isOpen ? 0 : -1}
        onClick={closeSidebar}
      />

      {sidebar}

      <main className="dashboard-main">
        <header className="dashboard-main__topbar">
          <button
            type="button"
            className="mobile-sidebar-toggle"
            onClick={toggleSidebar}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
          {topBar ? <div className="dashboard-main__topbar-slot">{topBar}</div> : null}
        </header>
        <div className={`dashboard-main__content ${contentClassName}`.trim()}>{children}</div>
      </main>
    </div>
  );
}

export default function DashboardShell(props) {
  return (
    <SidebarProvider>
      <DashboardShellInner {...props} />
    </SidebarProvider>
  );
}
