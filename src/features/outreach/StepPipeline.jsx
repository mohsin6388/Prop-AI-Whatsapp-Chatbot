import { Loader2, CheckCircle2, Clock, Pause, MessageCircle, Mail, ArrowRight } from 'lucide-react';

const META = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, bar: 'bg-green-500' },
  email: { label: 'Email', icon: Mail, bar: 'bg-brand-500' },
};

function Step({ channel, s, index }) {
  const m = META[channel];
  const Icon = m.icon;
  const done = s.total > 0 && s.sent + s.failed + s.cancelled === s.total;
  const sending = s.processing > 0;
  const paused = !done && !sending && s.paused > 0 && s.pending === 0;
  const pct = s.total ? Math.round(((s.sent + s.failed + s.cancelled) / s.total) * 100) : 0;

  let state = { text: 'Waiting', cls: 'text-ink-500 dark:text-ink-400', icon: <Clock size={14} /> };
  if (done) state = { text: 'Completed', cls: 'text-green-600 dark:text-green-400', icon: <CheckCircle2 size={14} /> };
  else if (sending) state = { text: 'Sending now…', cls: 'text-brand-600 dark:text-brand-300', icon: <Loader2 size={14} className="animate-spin" /> };
  else if (paused) state = { text: 'Paused', cls: 'text-amber-600 dark:text-amber-300', icon: <Pause size={14} /> };
  else if (s.sent > 0) state = { text: 'In progress', cls: 'text-brand-600 dark:text-brand-300', icon: <Loader2 size={14} className="animate-spin" /> };

  return (
    <div
      className={`flex-1 rounded-xl border p-3 transition ${
        sending
          ? 'border-brand-400 bg-brand-50 shadow-sm dark:border-brand-700 dark:bg-brand-950/30'
          : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-xs dark:bg-ink-800">{index}</span>
          <Icon size={15} /> {m.label}
        </span>
        <span className={`flex items-center gap-1 text-xs font-medium ${state.cls}`}>
          {state.icon} {state.text}
        </span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div
          className={`h-full ${m.bar} transition-all duration-700 ${sending ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
        {s.sent} of {s.total} sent
        {s.failed > 0 && <span className="text-red-600 dark:text-red-400"> · {s.failed} failed</span>}
      </p>
    </div>
  );
}

/** "Step 1 WhatsApp -> Step 2 Email" — kaun sa step abhi chal raha hai */
export default function StepPipeline({ campaign }) {
  const steps = ['whatsapp', 'email'].filter((ch) => campaign.channels[ch]);
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      {steps.map((ch, i) => (
        <div key={ch} className="flex flex-1 items-center gap-2">
          <Step channel={ch} s={campaign.stats[ch]} index={i + 1} />
          {i < steps.length - 1 && <ArrowRight size={18} className="hidden shrink-0 text-ink-300 sm:block" />}
        </div>
      ))}
    </div>
  );
}
