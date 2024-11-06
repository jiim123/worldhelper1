/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        'ibm': ['IBM Plex Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
  watchOptions: {
    ignored: ['**/node_modules/**', '**/.git/**'],
  },
}