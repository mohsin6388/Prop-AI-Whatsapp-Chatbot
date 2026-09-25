export default function ComingSoon({ title, phase }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">{title}</h1>
      <div className="card mt-6 flex flex-col items-center justify-center py-16 text-center">
        <p className="font-display text-lg font-semibold text-ink-900 dark:text-white">
          {title} is coming in {phase}
        </p>
        <p className="mt-2 max-w-sm text-sm text-ink-500 dark:text-ink-400">
          This section is scaffolded in the sidebar and routing already — the feature build follows the
          phased development plan.
        </p>
      </div>
    </div>
  );
}
