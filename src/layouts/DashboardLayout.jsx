import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  MessageSquare,
  CalendarCheck,
  Clock,
  Smartphone,
  BarChart3,
  Settings as SettingsIcon,
  UserCircle,
  LogOut,
  Moon,
  Sun,
  Menu,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/properties', label: 'Properties', icon: Building2 },
  { to: '/conversations', label: 'Conversations', icon: MessageSquare },
  { to: '/site-visits', label: 'Site Visits', icon: CalendarCheck },
  { to: '/follow-ups', label: 'Follow Ups', icon: Clock },
  { to: '/whatsapp', label: 'WhatsApp', icon: Smartphone },
  // { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const { user, clearSession } = useAuthStore();
  const navigate = useNavigate();

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode((d) => !d);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      navigate('/login');
    }
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Building2 size={20} />
        </span>
        <span className="font-display text-lg font-bold text-white">PropAI CRM</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-300 hover:bg-ink-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-800 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 transition hover:bg-ink-800 hover:text-white"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50 dark:bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 bg-ink-900 lg:block">{SidebarContent}</aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-ink-900">{SidebarContent}</aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-ink-100 bg-white px-4 dark:border-ink-800 dark:bg-ink-900 sm:px-6">
          <button
            className="text-ink-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </span>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-ink-900 dark:text-white">{user?.name}</p>
                
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
