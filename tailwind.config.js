/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        dash: {
          bg: '#0b0b14',
          panel: '#14142a',
          panel2: '#1b1b36',
          line: '#262648',
          indigo: '#6366f1',
          violet: '#8b5cf6',
          indigoBright: '#818cf8',
          mute: '#8b8fb0',
          text: '#ececf5',
          ok: '#22c55e',
          warn: '#f59e0b',
          err: '#ef4444',
        },
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 30px -5px rgba(99, 102, 241, 0.35)',
        card: '0 4px 20px -8px rgba(0, 0, 0, 0.5)',
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
    },
  },
  plugins: [],
};
