import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f3fbf5',
          100: '#e3f5e7',
          200: '#c7ebcf',
          300: '#9ed8ad',
          400: '#6fbe7e',
          500: '#3f9b56',
          600: '#2f7b43',
          700: '#245f34',
          800: '#1d4d29',
          900: '#153b20',
        },
        moss: '#5f7c59',
        berry: '#7a2e3a',
        mist: '#f7faf7',
      },
      boxShadow: {
        soft: '0 12px 40px rgba(29, 77, 41, 0.12)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, rgba(21,59,32,0.9), rgba(63,155,86,0.75))',
      },
    },
  },
  plugins: [forms],
};
