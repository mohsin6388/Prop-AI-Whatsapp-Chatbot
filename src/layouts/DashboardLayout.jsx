import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, CalendarCheck, Clock, Settings as SettingsIcon,
  UserCircle, LogOut, Moon, Sun, Menu, Mail, MessageCircle, Loader2, ChevronDown,
  MessageSquare, Upload, Flame, Smartphone, PanelLeftClose, PanelLeftOpen, FileText,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';
import { useOutreachSummaryLive } from '../hooks/useOutreachLive.js';

const NAV_GROUPS = [
  { type: 'link', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'link', to: '/leads', label: 'Upload Data', icon: Upload },
  { type: 'link', to: '/qualified-leads', label: 'Qualified Leads', icon: Flame },
  {
    type: 'group', key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, children: [
      { to: '/whatsapp/conversations', label: 'Conversations', icon: MessageSquare },
      { to: '/outreach/whatsapp', label: 'Bulk Messages', icon: Smartphone, channel: 'whatsapp' },
      { to: '/whatsapp/templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    type: 'group', key: 'email', label: 'Email', icon: Mail, children: [
      { to: '/outreach/email', label: 'Bulk Email', icon: Mail, channel: 'email' },
      { to: '/email/templates', label: 'Templates', icon: FileText },
      { to: '/email/conversations', label: 'Conversations', icon: MessageSquare },
      { to: '/email/details', label: 'Details', icon: PanelLeftOpen },
    ],
  },
  { type: 'link', to: '/properties', label: 'Properties', icon: Building2 },
  { type: 'link', to: '/site-visits', label: 'Site Visits', icon: CalendarCheck },
  { type: 'link', to: '/follow-ups', label: 'Follow Ups', icon: Clock },
  {
    type: 'group', key: 'account', label: 'Settings & Profile', icon: SettingsIcon, children: [
      { to: '/profile', label: 'Profile', icon: UserCircle },
      { to: '/settings', label: 'AI & Business Settings', icon: SettingsIcon },
    ],
  },
];

function OutreachBadge({ stats }) {
  if (!stats || !stats.total) return null;
  const done = stats.sent === stats.total;
  return <span className="ml-auto flex items-center gap-1.5">{stats.processing > 0 && <Loader2 size={12} className="animate-spin" />}<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${done ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-ink-200'}`} title={`${stats.sent} sent, ${stats.pending + stats.paused} pending, ${stats.failed} failed`}>{stats.sent}/{stats.total}</span></span>;
}

export default function DashboardLayout() {
  const { data: outreach } = useOutreachSummaryLive();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [expanded, setExpanded] = useState({ whatsapp: true, email: true, account: false });
  const { user, clearSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setExpanded((previous) => ({
      ...previous,
      whatsapp: location.pathname.startsWith('/whatsapp') || location.pathname === '/outreach/whatsapp' ? true : previous.whatsapp,
      email: location.pathname.startsWith('/email') || location.pathname === '/outreach/email' ? true : previous.email,
      account: ['/profile', '/settings'].includes(location.pathname) ? true : previous.account,
    }));
  }, [location.pathname]);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode((value) => !value);
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } finally { clearSession(); navigate('/login'); }
  };

  const linkClass = (active) => `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`;

  const renderNav = () => NAV_GROUPS.map((item) => {
    if (item.type === 'link') {
      const Icon = item.icon;
      return <NavLink key={item.to} to={item.to} end onClick={() => setSidebarOpen(false)} className={({ isActive }) => linkClass(isActive)} title={sidebarCollapsed ? item.label : undefined}>
        <Icon size={18} className="shrink-0" />{!sidebarCollapsed && <span>{item.label}</span>}
      </NavLink>;
    }
    const Icon = item.icon;
    const active = item.children.some((child) => location.pathname === child.to || location.pathname.startsWith(`${child.to}/`));
    const isOpen = expanded[item.key];
    return <div key={item.key} className="space-y-1">
      <button type="button" onClick={() => setExpanded((previous) => ({ ...previous, [item.key]: !previous[item.key] }))} className={linkClass(active)} title={sidebarCollapsed ? item.label : undefined} aria-expanded={Boolean(isOpen)}>
        <Icon size={18} className="shrink-0" />{!sidebarCollapsed && <><span className="flex-1">{item.label}</span><ChevronDown size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /></>}
      </button>
      {isOpen && !sidebarCollapsed && <div className="ml-4 space-y-1 border-l border-ink-700 pl-3">
        {item.children.map((child) => {
          const ChildIcon = child.icon;
          return <NavLink key={child.to} to={child.to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${isActive ? 'bg-ink-700 text-white' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'}`}>
            <ChildIcon size={15} className="shrink-0" /><span className="flex-1">{child.label}</span>{child.channel && <OutreachBadge stats={outreach?.[child.channel]} />}
          </NavLink>;
        })}
      </div>}
    </div>;
  });

  const SidebarContent = <div className="flex h-full flex-col">
    <div className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-5'} py-5`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Building2 size={20} /></span>
      {!sidebarCollapsed && <div className="min-w-0"><p className="truncate font-display text-sm font-bold text-white">Agarwaal Homes</p><p className="text-[10px] uppercase tracking-widest text-ink-400">PropAI CRM</p></div>}
    </div>
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">{renderNav()}</nav>
    <div className="space-y-1 border-t border-ink-800 p-3">
      <button onClick={() => setSidebarCollapsed((value) => !value)} className="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-ink-400 transition hover:bg-ink-800 hover:text-white lg:flex" title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />} {!sidebarCollapsed && 'Collapse sidebar'}
      </button>
      <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 transition hover:bg-ink-800 hover:text-white" title={sidebarCollapsed ? 'Log out' : undefined}>
        <LogOut size={18} />{!sidebarCollapsed && 'Log out'}
      </button>
    </div>
  </div>;

  return <div className="flex h-screen overflow-hidden bg-ink-50 dark:bg-ink-950">
    <aside className={`hidden flex-shrink-0 bg-ink-900 transition-[width] duration-200 lg:block ${sidebarCollapsed ? 'w-[76px]' : 'w-64'}`}>{SidebarContent}</aside>
    {sidebarOpen && <div className="fixed inset-0 z-40 lg:hidden"><button type="button" aria-label="Close navigation" className="absolute inset-0 h-full w-full bg-black/50" onClick={() => setSidebarOpen(false)} /><aside className="absolute left-0 top-0 h-full w-72 bg-ink-900">{SidebarContent}</aside></div>}
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-ink-100 bg-white px-4 dark:border-ink-800 dark:bg-ink-900 sm:px-6">
        <div className="flex items-center gap-3"><button className="text-ink-500 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={22} /></button><div><p className="text-sm font-semibold text-ink-900 dark:text-white">Agarwaal Homes</p><p className="text-[11px] text-ink-400">Property sales workspace</p></div></div>
        <div className="flex items-center gap-3"><button onClick={toggleDarkMode} aria-label="Toggle dark mode" className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button onClick={() => navigate('/profile')} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-ink-50 dark:hover:bg-ink-800"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">{user?.name?.[0]?.toUpperCase() || 'U'}</span><span className="hidden sm:block"><span className="block text-sm font-semibold text-ink-900 dark:text-white">{user?.name || 'Account'}</span><span className="block text-[10px] capitalize text-ink-400">{user?.role || 'User'}</span></span></button></div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6"><Outlet /></main>
    </div>
  </div>;
}
