/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#dbebff',
          300: '#bcd3ff',
          400: '#91b1ff',
          500: '#6385ff',
          600: '#425eff',
          700: '#3247eb',
          800: '#2738c4',
          900: '#25329c',
          950: '#151b5c',
        }
      }
    },
  },
  plugins: [],
}
