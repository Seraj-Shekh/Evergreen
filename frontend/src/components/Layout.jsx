import { Outlet, Link, NavLink } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  `text-sm font-medium transition ${isActive ? 'text-forest-700' : 'text-slate-600 hover:text-forest-700'}`;

export default function Layout() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-forest-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 font-semibold tracking-tight text-forest-900">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-forest-600 text-white shadow-soft">EB</div>
            <span>Evergreen Berry Harvest</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <NavLink to="/" className={linkClass} end>Home</NavLink>
            <NavLink to="/apply" className={linkClass}>Apply</NavLink>
            <NavLink to="/privacy-policy" className={linkClass}>Privacy</NavLink>
            <NavLink to="/terms" className={linkClass}>Terms</NavLink>
          </nav>
          <Link
            to="/apply"
            className="rounded-full bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-forest-800"
          >
            Apply Now
          </Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-forest-100 bg-forest-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div>
            <h2 className="text-lg font-semibold text-forest-900">Evergreen Berry Harvest</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Seasonal berry picking opportunities in Finland with a professional recruitment experience.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
            <p className="mt-3 text-sm text-slate-600">contact@example.com</p>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <Link className="text-slate-600 hover:text-forest-700" to="/privacy-policy">Privacy Policy</Link>
            <Link className="text-slate-600 hover:text-forest-700" to="/terms">Terms & Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
