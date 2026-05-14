/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        dash: {
          bg: '#0A0A0A',
          panel: '#0A0A0A',
          panel2: '#161616',
          card: '#111111',
          line: '#222222',
          indigo: '#0070F3',
          violet: '#0070F3',
          indigoBright: '#0070F3',
          mute: '#666666',
          text: '#EDEDED',
          ok: '#00C853',
          warn: '#F5A623',
          err: '#EE0000',
        },
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tighter: '-0.02em',
      },
      boxShadow: {
        glow: 'none',
        card: '0 0 0 1px rgba(255,255,255,0.04)',
      },
      animation: {
        pulseSlow: 'pulseSlow 2s ease-in-out infinite',
      },
      keyframes: {
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-in-out',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
};
