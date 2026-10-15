import { useCallback, useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Users, MessageSquareReply, Send, CalendarCheck, RefreshCw, TrendingUp } from 'lucide-react';
import { analyticsApi } from '../../api/analyticsApi.js';

function StatCard({ icon: Icon, label, value, hint }) {
  return <div className="card flex min-w-0 items-center gap-3 !p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"><Icon size={20} /></span><div className="min-w-0"><p className="text-xs font-medium text-ink-500 dark:text-ink-400">{label}</p><p className="mt-0.5 font-display text-2xl font-bold text-ink-900 dark:text-white">{Number(value || 0).toLocaleString('en-IN')}</p>{hint && <p className="mt-0.5 truncate text-[11px] text-ink-400">{hint}</p>}</div></div>;
}

const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'previous_month', label: 'Previous month' },
];

export default function AnalyticsPage() {
  const [cards, setCards] = useState(null);
  const [series, setSeries] = useState([]);
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async (isRefresh = false) => {
    setError('');
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [dashboardResponse, seriesResponse] = await Promise.all([
        analyticsApi.dashboard({}),
        analyticsApi.timeseries({ range }),
      ]);
      setCards(dashboardResponse.data?.cards || {});
      setSeries(seriesResponse.data?.series || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Analytics load nahi ho paayi. Connection check karke refresh karein.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return <div className="mx-auto max-w-[1500px] space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-xl font-bold text-ink-900 dark:text-white">Dashboard</h1><button onClick={() => fetchAll(true)} disabled={loading || refreshing} className="btn-secondary flex items-center gap-2 !px-3 !py-2 text-xs"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh</button></div>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><span>{error}</span><button onClick={() => fetchAll()} className="font-semibold underline">Try again</button></div>}

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Users} label="Total leads" value={cards?.totalLeads} />
      <StatCard icon={MessageSquareReply} label="Replies" value={cards?.repliesReceived} />
      <StatCard icon={Send} label="Messages sent" value={cards?.messagesSent} />
      <StatCard icon={CalendarCheck} label="Site visits" value={cards?.siteVisitsScheduled} hint={`${Number(cards?.siteVisitsCompleted || 0).toLocaleString('en-IN')} completed`} />
    </div>

    <section className="card !p-4 sm:!p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><TrendingUp size={19} className="text-brand-600" /><h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Message activity</h2></div><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Messages sent vs replies.</p></div><div className="flex flex-wrap gap-1 rounded-xl bg-ink-50 p-1 dark:bg-ink-800">{RANGES.map((item) => <button key={item.value} onClick={() => setRange(item.value)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${range === item.value ? 'bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white'}`}>{item.label}</button>)}</div></div>
      <div className="mt-3 h-[270px] w-full">{loading ? <div className="flex h-full items-center justify-center text-sm text-ink-400">Loading chart…</div> : series.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center"><MessageSquareReply size={28} className="text-ink-300" /><p className="text-sm font-medium text-ink-500 dark:text-ink-300">No message activity in this period</p><p className="text-xs text-ink-400">Activity will appear here after you start a campaign.</p></div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="period" tick={{ fontSize: 11 }} minTickGap={18} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="messagesSent" stroke="#4f46e5" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Messages sent" /><Line type="monotone" dataKey="repliesReceived" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Replies received" /></LineChart></ResponsiveContainer>}</div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 text-xs text-ink-400 dark:border-ink-800"><span>{range === 'previous_month' ? 'Showing the previous calendar month' : range === '30d' ? 'Showing the last 30 days, including today' : 'Showing the last 7 days, including today'}</span><span>Times shown in Asia/Kolkata</span></div>
    </section>
  </div>;
}
