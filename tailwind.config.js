/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html'
  ],
  theme: {
    extend: {
      colors: {
        /* ── Softretail Brand Palette (Flat & Modern) ─────────────────────────── */
        /* Replaces old Navy. Used for navigation, headers, dark backgrounds */
        navy: {
          DEFAULT: '#4A4A4A',
          dark: '#333333',
          light: '#666666',
        },
        ink: '#333333',
        slate: '#666666',
        surface: '#F4F6F9',
        paper: '#FFFFFF',
        divider: '#E2E5EB',
        
        /* Replaces old Gold/Orange. Brand Purple for primary actions/focus */
        accent: {
          DEFAULT: '#7B2D8E',
          dark: '#5C226B',
          light: '#9B4DAE',
          50: '#F5EAF7',
        },
        
        /* Brand Colors */
        brand: {
          purple: '#7B2D8E',
          cyan: '#0F9ED5',
          'lime': '#C4D600',
          'soft-green': '#4EA72E',
          gray: '#4A4A4A'
        },

        /* Semantic colors matched to brand */
        success: '#4EA72E',
        warning: '#F5A623',
        danger: '#D0021B',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 4px rgba(74, 74, 74, 0.04), 0 8px 16px -4px rgba(74, 74, 74, 0.08)',
        'card-lg': '0 4px 8px rgba(74, 74, 74, 0.06), 0 16px 32px -4px rgba(74, 74, 74, 0.12)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-success': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(78, 167, 46, 0.1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'pulse-success': 'pulse-success 600ms ease-in-out',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
