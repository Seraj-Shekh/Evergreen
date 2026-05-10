import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  `text-sm font-medium transition ${isActive ? 'text-forest-700' : 'text-slate-600 hover:text-forest-700'}`;

export default function Layout() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className={isAdminRoute ? 'sticky top-0 z-50 bg-white/90' : 'sticky top-0 z-50 border-b border-forest-100 bg-white/90 backdrop-blur'}>
        <div className={isAdminRoute ? 'mx-auto flex max-w-7xl items-center justify-center px-4 py-4 sm:px-6 lg:px-8' : 'mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8'}>
          <Link to="/" className={isAdminRoute ? 'flex items-center gap-3 font-semibold tracking-tight text-forest-900' : 'flex items-center gap-3 font-semibold tracking-tight text-forest-900'}>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-forest-600 text-white shadow-soft">EB</div>
            {!isAdminRoute && <span>Evergreen Berry Harvest</span>}
          </Link>
          {!isAdminRoute && (
            <>
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
            </>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      {/* Hide the verbose footer on the admin route to keep the admin UI minimal and professional */}
      {!isAdminRoute && (
        <footer className="border-t border-forest-100 bg-forest-50">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
            <div>
              <h2 className="text-lg font-semibold text-forest-900">Evergreen Berry Harvest</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                Seasonal berry picking opportunities in Finland with a professional recruitment experience.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Web by{' '}
                <a
                  href="https://serajshekh.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-forest-700 underline decoration-forest-300 decoration-2 underline-offset-4 transition hover:text-forest-800"
                >
                  Seraj Shekh
                </a>
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Support</h3>
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                <p>
                  <span className="block font-medium text-slate-800">For website problems or bugs</span>
                  <a className="text-forest-700 underline decoration-forest-300 underline-offset-4" href="mailto:contact@serajshekh.fi">
                    contact@serajshekh.fi
                  </a>
                </p>
                <p>
                  <span className="block font-medium text-slate-800">For other work related queries</span>
                  <span>JSC enterprises</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-600">
              <p><span className="font-medium text-slate-800">Company name:</span> JSC enterprises</p>
              <p><span className="font-medium text-slate-800">Address:</span> Oulu 90130 Ylioppilaantie 10B room 28</p>
              <p><span className="font-medium text-slate-800">Email:</span> <a className="text-forest-700 underline decoration-forest-300 underline-offset-4" href="mailto:jeevanchhetri465@gmail.com">jeevanchhetri465@gmail.com</a></p>
              <p><span className="font-medium text-slate-800">Phone:</span> <a className="text-forest-700 underline decoration-forest-300 underline-offset-4" href="tel:+358449500808">+358449500808</a></p>
              <p><span className="font-medium text-slate-800">Business ID:</span> 3586597-9</p>
              <Link className="text-slate-600 hover:text-forest-700" to="/privacy-policy">Privacy Policy</Link>
              <Link className="text-slate-600 hover:text-forest-700" to="/terms">Terms & Conditions</Link>
              <Link className="mt-2 inline-block text-xs text-slate-500 hover:text-forest-700" to="/admin">Admin</Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
