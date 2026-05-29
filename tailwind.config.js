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
