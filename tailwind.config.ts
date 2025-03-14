/** @type {import('tailwindcss').Config} */
import { createColorSet, withAccountKitUi } from "@account-kit/react/tailwind";

export default withAccountKitUi({
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  colors: {
    "btn-primary": createColorSet("#4a90e2", "#FF66CC"),
    "fg-accent-brand": createColorSet("#4a90e2", "#FF66CC"),
  },
  plugins: [],
});
