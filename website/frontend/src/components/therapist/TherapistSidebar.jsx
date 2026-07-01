import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FolderUp,
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Settings,
  Target,
  Users,
  Puzzle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChatUnread } from '../../context/ChatUnreadContext';
import AppSidebar from '../layout/AppSidebar.jsx';
import ChatUnreadBadge from './ChatUnreadBadge';

const THERAPIST_BASE = '/therapist';

export default function TherapistSidebar() {
  const { therapist, logout } = useAuth();
  const { totalUnread } = useChatUnread();
  const navigate = useNavigate();

  const sections = useMemo(
    () => [
      {
        items: [
          { to: `${THERAPIST_BASE}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
          { to: `${THERAPIST_BASE}/availability`, label: 'Availability', icon: CalendarClock },
          { to: `${THERAPIST_BASE}/appointments`, label: 'Appointments', icon: Calendar },
          { to: `${THERAPIST_BASE}/payments`, label: 'Payments', icon: CreditCard },
          { to: `${THERAPIST_BASE}/children`, label: 'Children', icon: Users },
          { to: `${THERAPIST_BASE}/assignments`, label: 'Assignments', icon: ClipboardList },
          {
            to: `${THERAPIST_BASE}/chat`,
            label: 'Messages',
            icon: MessageSquare,
            trailing: <ChatUnreadBadge count={totalUnread} />,
            ariaLabel: totalUnread ? `Messages, ${totalUnread} unread` : undefined,
          },
        ],
      },
      {
        label: 'Content banks',
        items: [
          { to: `${THERAPIST_BASE}/milestones`, label: 'Milestone Bank', icon: Target },
          { to: `${THERAPIST_BASE}/activity-bank`, label: 'Global Activity Bank', icon: Puzzle },
          { to: `${THERAPIST_BASE}/autism-qs`, label: 'Autism Questions', icon: HelpCircle },
        ],
      },
      {
        label: 'Library',
        items: [
          { to: `${THERAPIST_BASE}/uploads`, label: 'Upload resource', icon: FolderUp },
          { to: `${THERAPIST_BASE}/my-tips`, label: 'My Tips', icon: Lightbulb },
        ],
      },
      {
        label: 'Account',
        items: [{ to: `${THERAPIST_BASE}/settings`, label: 'Settings', icon: Settings }],
      },
    ],
    [totalUnread],
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName =
    therapist?.full_name ||
    `${therapist?.firstName || ''} ${therapist?.lastName || ''}`.trim() ||
    'Therapist';

  return (
    <AppSidebar
      homeTo={`${THERAPIST_BASE}/dashboard`}
      subtitle="Therapist"
      sections={sections}
      userName={displayName}
      userEmail={therapist?.email}
      onLogout={handleLogout}
      navClassName="therapist-sidebar-nav"
    />
  );
}
