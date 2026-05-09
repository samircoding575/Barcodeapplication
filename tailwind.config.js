/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html'
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1E3F',
          dark: '#061229',
          light: '#1E3A6B',
        },
        ink: '#0F172A',
        slate: '#475569',
        surface: '#F5F6F8',
        paper: '#FFFFFF',
        divider: '#E2E5EB',
        gold: {
          DEFAULT: '#B8935A',
          dark: '#8C6E3F',
        },
        success: '#047857',
        warning: '#B45309',
        danger: '#B91C1C',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.12)',
        'card-lg': '0 2px 4px rgba(15,23,42,0.06), 0 16px 40px -12px rgba(15,23,42,0.18)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-success': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(4,120,87,0.08)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'pulse-success': 'pulse-success 600ms ease-in-out',
      },
    },
  },
  plugins: [],
}
