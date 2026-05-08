import SectionHeading from '../components/SectionHeading.jsx';

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Privacy Policy"
        title="How applicant data is processed"
        description="This page explains what data is collected, why it is collected, and how applicants can exercise their rights."
      />
      <div className="prose prose-slate mt-10 max-w-none rounded-3xl border border-forest-100 bg-white p-8 shadow-soft">
        <h3>What data we collect</h3>
        <p>We collect only the information needed to review seasonal work applications: name, email, phone number, driving license status, car ownership status, car plate number when applicable, and any optional message.</p>
        <h3>Why we collect it</h3>
        <p>We use applicant data to review applications, communicate with candidates, and manage selection for seasonal berry picking work.</p>
        <h3>Legal basis</h3>
        <p>We process the data based on legitimate interest and pre-contractual steps requested by the applicant.</p>
        <h3>Retention</h3>
        <p>Applicant data is retained only as long as necessary for recruitment and related legal obligations.</p>
        <h3>Your rights</h3>
        <p>Applicants may request access, correction, deletion, or restriction of their data, and may object to processing in certain situations.</p>
        <h3>Contact</h3>
        <p>Contact placeholder: privacy@example.com</p>
        <h3>Deletion requests</h3>
        <p>To request deletion of your application data, contact us using the placeholder email above.</p>
      </div>
    </section>
  );
}
