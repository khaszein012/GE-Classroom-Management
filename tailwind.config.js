/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // All app colours are theme tokens: CSS variable channel triplets
        // (R G B) resolved per data-theme on <html>. The / <alpha-value>
        // placeholder (note the slash — required) keeps every /opacity
        // modifier working. Components never hard-code hex or theme names.
        obsidian: 'rgb(var(--c-obsidian) / <alpha-value>)',
        'antique-gold': 'rgb(var(--c-antique-gold) / <alpha-value>)',
        'warm-ivory': 'rgb(var(--c-warm-ivory) / <alpha-value>)',
        'deep-gold': 'rgb(var(--c-deep-gold) / <alpha-value>)',
        'ivory-dim': 'rgb(var(--c-ivory-dim) / <alpha-value>)',
        'warm-brick': 'rgb(var(--c-warm-brick) / <alpha-value>)',
        'brick-light': 'rgb(var(--c-brick-light) / <alpha-value>)',
        ink: {
          50: 'rgb(var(--c-ink-50) / <alpha-value>)',
          100: 'rgb(var(--c-ink-100) / <alpha-value>)',
          200: 'rgb(var(--c-ink-200) / <alpha-value>)',
          300: 'rgb(var(--c-ink-300) / <alpha-value>)',
          400: 'rgb(var(--c-ink-400) / <alpha-value>)',
          500: 'rgb(var(--c-ink-500) / <alpha-value>)',
          600: 'rgb(var(--c-ink-600) / <alpha-value>)',
          700: 'rgb(var(--c-ink-700) / <alpha-value>)',
          800: 'rgb(var(--c-ink-800) / <alpha-value>)',
          900: 'rgb(var(--c-ink-900) / <alpha-value>)',
          950: 'rgb(var(--c-ink-950) / <alpha-value>)',
        },
        // Decorative ramp retained for compatibility; not referenced by any
        // component (verified) and not part of the theme system.
        'earth-01': '#5b4327',
        'earth-02': '#76552d',
        'earth-03': '#946c32',
        'earth-04': '#ad833f',
        'earth-05': '#c6a15b',
        'earth-06': '#6f6b3a',
        'earth-07': '#86784a',
        'earth-08': '#87452f',
        'earth-09': '#9c4230',
        'earth-10': '#6b3528',
        'earth-11': '#3d2f27',
        'earth-12': '#0b0d10',
      },
      borderRadius: {
        DEFAULT: '8px',
        button: '10px',
        card: '14px',
      },
      boxShadow: {
        // Warm-tinted shadows (brown-black, not pure black) so elevation
        // feels gilded rather than grey — in every theme.
        soft: '0 1px 2px rgba(64, 50, 20, 0.07)',
        'soft-md': '0 3px 10px rgba(64, 50, 20, 0.10)',
        'soft-lg': '0 14px 36px rgba(64, 50, 20, 0.16)',
      },
      keyframes: {
        'fade-scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-right': { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'slide-in-left': { from: { opacity: '0', transform: 'translateX(-100%)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        skeleton: { '100%': { transform: 'translateX(100%)' } },
        // Gilded Classroom additions
        shine: {
          '0%': { transform: 'translateX(-130%) skewX(-14deg)' },
          '100%': { transform: 'translateX(230%) skewX(-14deg)' },
        },
        'confetti-fall': {
          from: { transform: 'translateY(-8vh) rotate(0deg)', opacity: '1' },
          to: { transform: 'translateY(108vh) rotate(var(--rot))', opacity: '0.9' },
        },
        'toast-pop': {
          from: { opacity: '0', transform: 'translateY(-10px) scale(0.95)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'rule-in': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'medal-pop': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '60%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-scale-in': 'fade-scale-in 220ms cubic-bezier(0.34, 1.4, 0.64, 1)',
        'slide-up': 'slide-up 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        shine: 'shine 1.1s ease 0.15s 1 both',
        'toast-pop': 'toast-pop 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'rule-in': 'rule-in 800ms cubic-bezier(0.22, 1, 0.36, 1) 0.2s both',
        'medal-pop': 'medal-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        // Emitted only when animate-confetti-fall is used — Confetti.tsx uses
        // the class and overrides duration/delay per piece inline. `both`
        // keeps delayed pieces hidden above the screen until their turn.
        'confetti-fall': 'confetti-fall 2.4s linear both',
      },
    },
  },
  plugins: [],
};
