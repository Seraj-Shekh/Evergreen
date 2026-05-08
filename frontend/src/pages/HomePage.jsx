import { Link } from 'react-router-dom';
import SectionHeading from '../components/SectionHeading.jsx';
import berryImage from '../../assets/berry.jpg';

const benefits = [
  { title: 'Flexible Work', text: 'Seasonal work that adapts to the harvest schedule.' },
  { title: 'Outdoor Environment', text: 'A fresh, natural setting in Finnish berry fields.' },
  { title: 'Supportive Team', text: 'Join an organized crew with a respectful workplace.' },
  { title: 'Seasonal Opportunities', text: 'Short-term work designed for the berry season.' },
];

const requirements = [
  'Must be legally allowed to work',
  'Driving license preferred',
  'Own vehicle helpful but optional',
  'Physically active outdoor work',
];

const faqs = [
  { q: 'Do I need experience?', a: 'No. We welcome applicants with or without prior berry picking experience.' },
  { q: 'Can I apply without a car?', a: 'Yes. A car is helpful, but it is not mandatory.' },
  { q: 'How long is the season?', a: 'The length of the season depends on weather and harvest conditions.' },
  { q: 'Will accommodation be provided?', a: 'Accommodation may be discussed for selected applicants when available.' },
  { q: 'How will I know if I am selected?', a: 'Selected applicants will be contacted by email.' },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-forest-900 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-125"
          style={{ backgroundImage: `url(${berryImage})` }}
        />
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="relative mx-auto grid min-h-[82vh] max-w-7xl items-center px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
              Seasonal Berry Picking Opportunities in Finland
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">Join Evergreen Berry Harvest</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/85">
              Apply for seasonal berry picking opportunities in Finland.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/apply" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-forest-800 shadow-soft transition hover:bg-forest-50">
                Apply Now
              </Link>
              <a href="#about" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="About"
          title="Work in Finnish nature with a professional seasonal team"
          description="We connect motivated workers with seasonal berry picking opportunities built around a respectful, organized, and practical working environment."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {benefits.map(item => (
            <article key={item.title} className="rounded-3xl border border-forest-100 bg-white p-6 shadow-soft">
              <h3 className="text-lg font-semibold text-forest-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-forest-50/70 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Why Join Us"
            title="A recruitment experience built around clarity and trust"
            description="We keep the process straightforward and focused on the essentials so applicants know what to expect."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map(item => (
              <div key={item.title} className="rounded-3xl bg-white p-6 shadow-soft">
                <div className="h-12 w-12 rounded-2xl bg-forest-100" />
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Requirements"
          title="What we look for"
          description="We only ask for the information needed to assess seasonal suitability and communicate with applicants."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {requirements.map(item => (
            <div key={item} className="rounded-2xl border border-forest-100 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-soft">{item}</div>
          ))}
        </div>
      </section>

      <section className="bg-mist py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Helpful answers for applicants considering a seasonal role."
          />
          <div className="mt-10 space-y-4">
            {faqs.map(item => (
              <details key={item.q} className="group rounded-2xl border border-forest-100 bg-white p-6 shadow-soft">
                <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">{item.q}</summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
