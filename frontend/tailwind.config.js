/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // O fundo 'branco gelo' que você pediu
        background: '#F8F9FA', 
        // As 3 cores dinâmicas da Prefeitura mapeadas para variáveis CSS
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        // Cor do texto padrão (Cinza chumbo para leitura agradável)
        surface: '#FFFFFF',
        textMain: '#334155', 
      }
    },
  },
  plugins: [],
}