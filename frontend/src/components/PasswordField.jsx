import { useState } from 'react';

const eyeIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="currentColor"
      d="M12 5c-5.5 0-9.9 3.6-11.5 7 1.6 3.4 6 7 11.5 7s9.9-3.6 11.5-7C21.9 8.6 17.5 5 12 5Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Zm0-2A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5Z"
    />
  </svg>
);

const eyeOffIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="currentColor"
      d="M12 5c-5.5 0-9.9 3.6-11.5 7 .8 1.8 2.1 3.5 3.8 4.8L1.7 19.4 3.1 20.8l20-20-1.4-1.4-3 3C16.4 6 14.3 5 12 5Zm0 11.5c-.8 0-1.6-.2-2.2-.6l1.5-1.5A2.5 2.5 0 0 0 14 11.2l1.5-1.5c.4.7.7 1.5.7 2.3A4.5 4.5 0 0 1 12 16.5Zm0-9.5c1.3 0 2.5.5 3.4 1.3l-1.6 1.6A2.5 2.5 0 0 0 10 13.7l-1.6 1.6A4.5 4.5 0 0 1 7.5 12 4.5 4.5 0 0 1 12 7Zm-8.8 7c1.1 2 2.9 3.8 5.4 5l-1.7 1.7C4 18.4 1.8 16 1.1 14c.4-.9 1.1-1.9 2.1-3.1Zm19.7 0c-1.1-2-2.9-3.8-5.4-5l1.7-1.7c3 1.6 5.2 4 5.9 6-.4.9-1.1 1.9-2.1 3.1Z"
    />
  </svg>
);

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  required,
  placeholder,
  inputClassName = 'input mt-2',
  labelClassName = 'block text-sm font-medium text-slate-700',
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label className={labelClassName}>
      {label}
      <div className="relative mt-2">
        <input
          className={`${inputClassName} pr-11`}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setIsVisible(current => !current)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-forest-700"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          title={isVisible ? 'Hide password' : 'Show password'}
        >
          {isVisible ? eyeOffIcon : eyeIcon}
        </button>
      </div>
    </label>
  );
}