/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ramen-shop inspired "Modern Vintage" Japanese palette
        cream: {
          50: "#FDFBF5",
          100: "#F5F0E3",
          200: "#EDE5D0",
          300: "#DED4BA",
          400: "#C8BB9E",
        },
        vermillion: {
          50: "#FEF0EE",
          100: "#FDDCD8",
          200: "#F9AFA5",
          300: "#F07D6E",
          400: "#E85A45",
          500: "#D94025",
          600: "#B8331E",
          700: "#8F2818",
        },
        sumi: {
          50: "#F5F4F2",
          100: "#E8E5E1",
          200: "#D1CCC5",
          300: "#A39E96",
          400: "#78716C",
          500: "#57534E",
          600: "#3D3835",
          700: "#292524",
          800: "#1C1917",
          900: "#0C0A09",
        },
        matcha: {
          50: "#F2F5ED",
          100: "#E0E8D5",
          200: "#BCCEA3",
          300: "#93B06A",
          400: "#728F45",
          500: "#5C7A2E",
        },
        gold: {
          50: "#FBF8EE",
          100: "#F5EDCE",
          200: "#E8D69E",
          300: "#D4B86C",
          400: "#C4A048",
        },
        /* Home-page palette — Modern Japanese Minimalism */
        offwhite:  "#F7F5F0",
        parchment: "#EDE9E0",
        slate: {
          deep:  "#1C2333",
          mid:   "#3D4A5C",
          light: "#8A95A3",
          pale:  "#C8CDD4",
        },
        crimson: {
          DEFAULT: "#C0392B",
          soft:    "#D95C4A",
          pale:    "#F5E6E4",
        },
      },
      fontFamily: {
        /* Single unified font stack across the whole app. All four
           Tailwind utilities (font-display / font-body / font-serif
           / font-sans) resolve to the same stack as the Explore map
           UI, so the Home page reads with identical typography. */
        display: ['"Noto Sans Hebrew"', '"Inter"', '"Noto Sans JP"', 'sans-serif'],
        body:    ['"Noto Sans Hebrew"', '"Inter"', '"Noto Sans JP"', 'sans-serif'],
        serif:   ['"Noto Sans Hebrew"', '"Inter"', '"Noto Sans JP"', 'sans-serif'],
        sans:    ['"Noto Sans Hebrew"', '"Inter"', '"Noto Sans JP"', 'sans-serif'],
      },
      borderWidth: {
        '6': '6px',
        '8': '8px',
      },
    },
  },
  plugins: [],
};
