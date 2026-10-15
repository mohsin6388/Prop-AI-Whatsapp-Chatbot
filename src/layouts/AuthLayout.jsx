import { Outlet, Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left: form panel */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-16 lg:w-[480px] lg:flex-none xl:w-[520px]">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Building2 size={20} />
            </span>
            <span className="font-display text-lg font-bold text-ink-900 dark:text-white">
              Agarwaal Homes <span className="font-normal text-ink-400">CRM</span>
            </span>
          </Link>
          <div className="mt-10">
            <Outlet />
          </div>
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900">
          <div className="flex h-full flex-col justify-between p-16">
            <div />
            <div className="max-w-md">
              <p className="font-display text-3xl font-bold leading-tight text-white">
                Your property pipeline, finally in one place.
              </p>
              <p className="mt-4 text-brand-100">
                Track campaigns, qualify genuine buyers, and manage property visits without switching between tools.
              </p>
            </div>
            <div className="flex gap-8 text-brand-100">
              <div>
                <p className="font-display text-2xl font-bold text-white">One view</p>
                <p className="text-sm">Every lead and channel</p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-white">AI + Human</p>
                <p className="text-sm">Automation when you need it</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
