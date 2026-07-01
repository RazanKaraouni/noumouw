import { AdminToastProvider } from '../context/AdminToastContext.jsx';

export default function AdminProviders({ children }) {
  return <AdminToastProvider>{children}</AdminToastProvider>;
}
