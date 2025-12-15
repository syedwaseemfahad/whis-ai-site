/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['SF Pro Display', 'Inter', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      colors: {
        page: '#000000',
        glass: 'rgba(255, 255, 255, 0.05)'
      },
      animation: {
        'scroll': 'scroll 40s linear infinite',
        'float': 'float 8s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scroll: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-100%)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } }
      }
    },
  },
  plugins: [],
}
