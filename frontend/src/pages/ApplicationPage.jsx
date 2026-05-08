import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionHeading from '../components/SectionHeading.jsx';
import { submitApplication } from '../lib/api.js';

const initialForm = {
  fullName: '',
  email: '',
  phoneNumber: '',
  hasDrivingLicense: 'yes',
  hasOwnCar: 'no',
  carPlateNumber: '',
  additionalDescription: '',
  acceptedTerms: false,
};

const emailRegex = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const phoneRegex = /^(?:\+358|00358|0)(?:[\s-]?\d){5,10}$/;

const normalizePhoneNumber = value => value.replace(/[\s()-]/g, '');

export default function ApplicationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const requiresCarPlate = useMemo(() => form.hasOwnCar === 'yes', [form.hasOwnCar]);

  const validate = () => {
    const nextErrors = {};
    const phoneValue = normalizePhoneNumber(form.phoneNumber.trim());

    if (!form.fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!emailRegex.test(form.email.trim()) || form.email.trim().length > 254) nextErrors.email = 'Enter a valid email address.';
    if (!phoneRegex.test(phoneValue) || !/^((?:\+358|00358)\d{5,10}|0\d{5,10})$/.test(phoneValue)) {
      nextErrors.phoneNumber = 'Enter a valid Finnish phone number, for example 040 123 4567 or +358 40 123 4567.';
    }
    if (requiresCarPlate && !form.carPlateNumber.trim()) nextErrors.carPlateNumber = 'Car plate number is required when you have a car.';
    if (!form.acceptedTerms) nextErrors.acceptedTerms = 'You must accept the Terms & Conditions and Privacy Policy.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await submitApplication({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        hasDrivingLicense: form.hasDrivingLicense === 'yes',
        hasOwnCar: form.hasOwnCar === 'yes',
        carPlateNumber: requiresCarPlate ? form.carPlateNumber.trim() : '',
        additionalDescription: form.additionalDescription.trim(),
        acceptedTerms: form.acceptedTerms,
      });
      navigate('/success');
    } catch (error) {
      setSubmitError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Application"
        title="Apply for a seasonal berry picking role"
        description="Please provide accurate information so we can review your application efficiently."
      />

      <form onSubmit={handleSubmit} className="mt-10 space-y-6 rounded-3xl border border-forest-100 bg-white p-6 shadow-soft sm:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Full Name" error={errors.fullName}>
            <input name="fullName" value={form.fullName} onChange={handleChange} className="input" />
          </Field>
          <Field label="Email Address" error={errors.email}>
            <input name="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={handleChange} className="input" />
          </Field>
          <Field label="Finnish Phone Number" error={errors.phoneNumber}>
            <input
              name="phoneNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="040 123 4567"
              value={form.phoneNumber}
              onChange={handleChange}
              className="input"
            />
          </Field>
          <Field label="Do you have a driving license?">
            <select name="hasDrivingLicense" value={form.hasDrivingLicense} onChange={handleChange} className="input">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Do you have your own car?">
            <select name="hasOwnCar" value={form.hasOwnCar} onChange={handleChange} className="input">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          {requiresCarPlate && (
            <Field label="Car Number Plate" error={errors.carPlateNumber}>
              <input name="carPlateNumber" value={form.carPlateNumber} onChange={handleChange} className="input" />
            </Field>
          )}
        </div>

        <Field label="Additional Description / Message">
          <textarea name="additionalDescription" rows="5" value={form.additionalDescription} onChange={handleChange} className="input" />
        </Field>

        <label className="flex items-start gap-3 rounded-2xl bg-forest-50 p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            name="acceptedTerms"
            checked={form.acceptedTerms}
            onChange={handleChange}
            className="mt-1 rounded border-forest-300 text-forest-700 focus:ring-forest-600"
          />
          <span>
            I agree to the{' '}
            <a className="text-forest-700 underline" href="/terms">Terms & Conditions</a>{' '}
            and{' '}
            <a className="text-forest-700 underline" href="/privacy-policy">Privacy Policy</a>
          </span>
        </label>
        {errors.acceptedTerms && <p className="text-sm text-red-600">{errors.acceptedTerms}</p>}
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-forest-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
