/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './services/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: { 850: '#1e293b', 900: '#0f172a', 950: '#020617' },
        primary: { 500: '#3b82f6', 600: '#2563eb' },
      },
    },
  },
  plugins: [],
};
