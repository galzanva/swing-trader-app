/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      'var(--color-bg)',
        surface: {
          1: 'var(--color-surface-1)',
          2: 'var(--color-surface-2)',
          3: 'var(--color-surface-3)',
          4: 'var(--color-surface-4)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light:   'var(--color-border-light)',
          hover:   'var(--color-border-hover)',
        },
        text: {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted:     'var(--color-text-muted)',
        },
        'card-hover': 'var(--color-card-hover)',
        accent: {
          DEFAULT: '#22c55e',
          hover:   '#16a34a',
        },
        profit: '#22c55e',
        loss:   '#ef4444',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
    },
  },
  plugins: [],
};
