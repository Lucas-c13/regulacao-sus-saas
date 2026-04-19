/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8F9FA',
        // Usamos uma sintaxe com fallback seguro
        primary: 'var(--color-primary, #0284c7)',
        secondary: 'var(--color-secondary, #0369a1)',
        accent: 'var(--color-accent, #f59e0b)',
        surface: '#FFFFFF',
        textMain: '#334155',
      }
    },
  },
  plugins: [],
}