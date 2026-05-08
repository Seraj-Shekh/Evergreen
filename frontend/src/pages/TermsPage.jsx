import SectionHeading from '../components/SectionHeading.jsx';

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Terms & Conditions"
        title="Recruitment process terms"
        description="These terms explain applicant responsibilities and how the recruitment process is handled."
      />
      <div className="prose prose-slate mt-10 max-w-none rounded-3xl border border-forest-100 bg-white p-8 shadow-soft">
        <h3>Recruitment process</h3>
        <p>Submitting an application does not guarantee selection or employment. Selection depends on seasonal needs and applicant suitability.</p>
        <h3>Accuracy of information</h3>
        <p>Applicants must provide accurate, complete, and current information. False or misleading information may result in rejection.</p>
        <h3>Communication consent</h3>
        <p>By submitting the application, you consent to being contacted about recruitment matters through the details you provide.</p>
        <h3>Company rights</h3>
        <p>Evergreen Berry Harvest may review, reject, or keep applications pending based on operational requirements and recruitment decisions.</p>
        <h3>Acceptance</h3>
        <p>Applications can only be submitted after acceptance of these terms and the privacy policy.</p>
      </div>
    </section>
  );
}
