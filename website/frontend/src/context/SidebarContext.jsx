import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const closeSidebar = useCallback(() => setIsOpen(false), []);
  const openSidebar = useCallback(() => setIsOpen(true), []);
  const toggleSidebar = useCallback(() => setIsOpen((open) => !open), []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setIsOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const value = useMemo(
    () => ({ isOpen, closeSidebar, openSidebar, toggleSidebar }),
    [isOpen, closeSidebar, openSidebar, toggleSidebar],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}
