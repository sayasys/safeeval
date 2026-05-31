/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FBF8F3',
          100: '#F5F0E6',
        },
        sage: {
          50: '#F1F5F2',
          100: '#DCE8DE',
          200: '#B4CFB8',
          300: '#8AB592',
          400: '#6B9C75',
          500: '#52835D',
          600: '#3F6948',
          700: '#2E4F35',
        },
        coral: {
          400: '#F7866F',
          500: '#F46E54',
          600: '#E25439',
        },
        // Cool institutional palette -- the whole site (tool AND marketing
        // surfaces; the warm cream/sage/coral hybrid was retired 2026-05-30).
        // The neutral-cool ramp maps directly onto Tailwind's built-in slate
        // scale (slate-50 #F8FAFC, slate-200 #E2E8F0, slate-700 #334155), so
        // only the brand accent and the tool page background need custom tokens.
        // The cream/sage/coral tokens above are retained for the regression
        // guard in tests/app/palette-surfaces.test.ts but are no longer applied.
        brand: {
          blue: '#2962E0', // primary brand, CTAs, links on tool surfaces
        },
        tool: '#F6F9FC', // tool-surface page background (Stripe-Radar gray)
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -10px rgba(45, 79, 53, 0.08)',
        // Cool-institutional elevation ramp (slate-900 #0F172A tint). Additive
        // tokens for the marketing-surface depth pass -- tool surfaces keep
        // their existing shadow-soft. card = resting card, lift = hover state,
        // float = prominent elements (hero illustration, CTA banner).
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 4px 16px -4px rgba(15, 23, 42, 0.10)',
        lift: '0 4px 10px -2px rgba(15, 23, 42, 0.08), 0 18px 36px -8px rgba(15, 23, 42, 0.16)',
        float: '0 16px 32px -8px rgba(15, 23, 42, 0.14), 0 36px 64px -16px rgba(15, 23, 42, 0.22)',
      },
    },
  },
  plugins: [],
}
