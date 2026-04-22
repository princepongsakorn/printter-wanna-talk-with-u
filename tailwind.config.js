/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Sarabun",
          "sans-serif",
        ],
      },
      keyframes: {
        "typing-dot": {
          "0%, 60%, 100%": {
            transform: "translateY(0)",
            opacity: "0.4",
          },
          "30%": {
            transform: "translateY(-4px)",
            opacity: "1",
          },
        },
      },
      animation: {
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
