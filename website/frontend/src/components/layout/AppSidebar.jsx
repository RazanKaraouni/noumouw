import { Fragment, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSidebar } from '../../context/SidebarContext.jsx';
import BrandLogo from './BrandLogo.jsx';
import SidebarNavItem from './SidebarNavItem.jsx';
import SidebarUserFooter from './SidebarUserFooter.jsx';

export default function AppSidebar({ homeTo, subtitle, sections, userName, userEmail, onLogout, navClassName = '' }) {
  const { isOpen, closeSidebar } = useSidebar();
  const location = useLocation();

  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  return (
    <aside className={`app-sidebar${isOpen ? ' is-open' : ''}`} aria-label="Main navigation">
      <div className="app-sidebar__header">
        <BrandLogo to={homeTo} subtitle={subtitle} />
      </div>

      <nav className={`app-sidebar__nav ${navClassName}`.trim()}>
        {sections.map((section, index) => (
          <Fragment key={section.label || `section-${index}`}>
            {section.label ? <div className="sidebar-section-label">{section.label}</div> : null}
            {section.items.map((item) => (
              <SidebarNavItem key={item.to} {...item} onNavigate={closeSidebar} />
            ))}
          </Fragment>
        ))}
      </nav>

      <SidebarUserFooter name={userName} email={userEmail} onLogout={onLogout} />
    </aside>
  );
}
