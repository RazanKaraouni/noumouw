import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AdminToastContext = createContext(null);

let toastId = 0;

export function AdminToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message) => {
    const id = ++toastId;
    const text = String(message || '').trim() || 'Something went wrong.';
    setToasts((prev) => [...prev, { id, type, message: text }]);
    window.setTimeout(() => dismiss(id), 5000);
    return id;
  }, [dismiss]);

  const value = useMemo(
    () => ({
      success: (msg) => push('success', msg),
      error: (msg) => push('error', msg),
      info: (msg) => push('info', msg),
    }),
    [push],
  );

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div
        className="fixed top-4 right-4 z-[2000] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`admin-toast ${
              t.type === 'success'
                ? 'admin-toast--success'
                : t.type === 'info'
                  ? 'admin-toast--info'
                  : 'admin-toast--error'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}

export function useAdminToast() {
  const ctx = useContext(AdminToastContext);
  if (!ctx) throw new Error('useAdminToast must be used within AdminToastProvider');
  return ctx;
}
