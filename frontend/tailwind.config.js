/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // More specific paths
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Add this to ensure proper file watching
  watchOptions: {
    ignored: ['**/node_modules/**', '**/.git/**'],
  },
}