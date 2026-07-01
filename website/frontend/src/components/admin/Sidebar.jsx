import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/axios.js';
import AppSidebar from '../layout/AppSidebar.jsx';

const MAIN_NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/users', label: 'Parents & Children', icon: Users },
  { to: '/reports/autism-screening', label: 'Autism Screening Reports', icon: FileBarChart },
  { to: '/reports/milestones-progress', label: 'Milestones Progress Reports', icon: TrendingUp },
  { to: '/therapists', label: 'Therapists', icon: Stethoscope },
  { to: '/appointments', label: 'Appointments', icon: Calendar },
  { to: '/payments', label: 'Payments', icon: CreditCard },
];

const CONTENT_NAV = [
  { to: '/content-moderation', label: 'Resources Board', icon: ShieldCheck },
  { to: '/moderation-queue', label: 'Report Queue', icon: ShieldAlert, badgeKey: 'moderation' },
  { to: '/community-posts', label: 'Community Posts', icon: MessageSquare },
  { to: '/tips-moderation', label: 'Tips', icon: Lightbulb },
  { to: '/moderation-log', label: 'Moderation Log', icon: ScrollText },
];

const ACCOUNT_NAV = [{ to: '/settings', label: 'Settings', icon: Settings }];

export default function Sidebar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [badges, setBadges] = useState({ moderation: 0 });

  const loadBadges = useCallback(async () => {
    try {
      const modRes = await api.get('/reports/pending').catch(() => ({ data: [] }));
      setBadges({
        moderation: Array.isArray(modRes.data) ? modRes.data.length : 0,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadBadges();
    const timer = window.setInterval(loadBadges, 60000);
    return () => window.clearInterval(timer);
  }, [loadBadges]);

  const sections = useMemo(
    () => [
      { items: MAIN_NAV },
      {
        label: 'Content',
        items: CONTENT_NAV.map((item) => ({
          ...item,
          badge: item.badgeKey ? badges[item.badgeKey] : 0,
        })),
      },
      { label: 'Account', items: ACCOUNT_NAV },
    ],
    [badges],
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName =
    admin?.full_name || `${admin?.firstName || ''} ${admin?.lastName || ''}`.trim() || 'Admin';

  return (
    <AppSidebar
      homeTo="/overview"
      subtitle="Admin Console"
      sections={sections}
      userName={displayName}
      userEmail={admin?.email}
      onLogout={handleLogout}
      navClassName="admin-sidebar-nav"
    />
  );
}
