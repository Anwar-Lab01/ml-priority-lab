import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { PAGE_META } from '../../../config/scenarios';

export function AppLayout() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] ?? { title: 'ML Priority Lab', description: '' };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="ml-60 flex-1">
        {/* Page header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="px-8 py-5">
            <h1 className="text-lg font-bold text-slate-900">{meta.title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
          </div>
        </header>

        {/* Page content */}
        <div className="px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
