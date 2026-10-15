import { useAuthStore } from '../../store/authStore.js';

const PLACEHOLDER_STATS = [
  { label: 'Total Leads', value: '—' },
  { label: 'Active Conversations', value: '—' },
  { label: 'Hot Leads', value: '—' },
  { label: 'Site Visits Scheduled', value: '—' },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">
        Welcome back, {user?.name?.split(' ')[0]}
      </h1>
      <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
        Here's what's happening across your leads and conversations.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_STATS.map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-sm font-medium text-ink-500 dark:text-ink-400">{stat.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6">
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Phase 1 (Auth &amp; foundation) is live. Lead/Property CRM, WhatsApp connection, the AI conversation
          engine, and full analytics land in the next phases per the development plan.
        </p>
      </div>
    </div>
  );
}
