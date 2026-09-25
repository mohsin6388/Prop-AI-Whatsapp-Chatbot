import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Users, MessageSquare, Flame, CalendarCheck, TrendingUp, Clock } from 'lucide-react';
import { analyticsApi } from '../../api/analyticsApi.js';

const COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xs text-ink-500 dark:text-ink-400">{label}</p>
        <p className="font-display text-lg font-bold text-ink-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [cards, setCards] = useState(null);
  const [granularity, setGranularity] = useState('daily');
  const [series, setSeries] = useState([]);
  const [funnel, setFunnel] = useState({ salesFunnel: [], siteVisitFunnel: [] });
  const [sources, setSources] = useState([]);
  const [properties, setProperties] = useState([]);

  const fetchAll = useCallback(async () => {
    const [d, t, f, s, p] = await Promise.all([
      analyticsApi.dashboard({}),
      analyticsApi.timeseries({ granularity }),
      analyticsApi.funnel({}),
      analyticsApi.leadSources({}),
      analyticsApi.propertyPerformance({}),
    ]);
    setCards(d.data.cards);
    setSeries(t.data.series);
    setFunnel(f.data);
    setSources(s.data);
    setProperties(p.data);
  }, [granularity]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!cards) return <p className="text-sm text-ink-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Analytics</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Leads" value={cards.totalLeads} />
        <StatCard icon={Flame} label="Hot Leads" value={cards.hotLeads} />
        <StatCard icon={MessageSquare} label="Messages Sent" value={cards.messagesSent} />
        <StatCard icon={CalendarCheck} label="Site Visits Done" value={cards.siteVisitsCompleted} />
        <StatCard icon={TrendingUp} label="Conversion Rate" value={`${cards.conversionRate}%`} />
        <StatCard icon={Clock} label="Pending Follow-ups" value={cards.pendingFollowUps} />
        <StatCard icon={Users} label="Deals Closed" value={cards.dealsClosed} />
        <StatCard icon={MessageSquare} label="Active Conversations" value={cards.activeConversations} />
      </div>

      {/* Timeseries */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">Trends</h2>
          <div className="flex gap-1">
            {['daily', 'weekly', 'monthly'].map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`rounded-full px-3 py-1 text-xs capitalize ${
                  granularity === g ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="leadsAdded" stroke={COLORS[0]} name="Leads Added" />
              <Line type="monotone" dataKey="messagesSent" stroke={COLORS[1]} name="Messages Sent" />
              <Line type="monotone" dataKey="repliesReceived" stroke={COLORS[2]} name="Replies" />
              <Line type="monotone" dataKey="siteVisitsScheduled" stroke={COLORS[3]} name="Site Visits" />
              <Line type="monotone" dataKey="dealsClosed" stroke={COLORS[4]} name="Deals Closed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales funnel */}
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">Sales Funnel</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel.salesFunnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Site visit funnel */}
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">Site Visit Funnel</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel.siteVisitFunnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead sources */}
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">Lead Sources</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} label>
                  {sources.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Property performance table */}
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">Top Properties</h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500 dark:text-ink-400">
                <th className="pb-2">Project</th>
                <th className="pb-2">City</th>
                <th className="pb-2 text-right">Recommended</th>
                <th className="pb-2 text-right">Visited</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.propertyId} className="border-t border-ink-50 dark:border-ink-800">
                  <td className="py-2 font-medium text-ink-900 dark:text-white">{p.projectName}</td>
                  <td className="py-2 text-ink-500 dark:text-ink-400">{p.city}</td>
                  <td className="py-2 text-right">{p.recommendedCount}</td>
                  <td className="py-2 text-right">{p.closedCount}</td>
                </tr>
              ))}
              {properties.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-ink-400">Data nahi hai abhi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}