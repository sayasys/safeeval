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
        // Cool institutional palette -- tool surfaces only (evaluator, /app/*,
        // /intelligence, signup, login). Marketing surfaces keep cream/sage/coral.
        // The neutral-cool ramp maps directly onto Tailwind's built-in slate
        // scale (slate-50 #F8FAFC, slate-200 #E2E8F0, slate-700 #334155), so
        // only the brand accent and the tool page background need custom tokens.
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
      },
    },
  },
  plugins: [],
}
