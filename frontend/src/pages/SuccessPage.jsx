import { Link } from 'react-router-dom';

export default function SuccessPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full rounded-3xl border border-forest-100 bg-white p-10 text-center shadow-soft">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-forest-100 text-2xl">✓</div>
        <h1 className="mt-6 text-3xl font-semibold text-slate-900">Thank you for your application.</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">We will contact selected applicants by email.</p>
        <Link to="/" className="mt-8 inline-flex rounded-full bg-forest-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-forest-800">
          Back to Home
        </Link>
      </div>
    </section>
  );
}
