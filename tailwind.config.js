/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#F3F7F9',
                navy: '#1B334B',
                accent: '#D9E8F1',
                primary: '#1B334B',
                success: '#27AE60',
                danger: '#EB5757',
                warning: '#F2C94C',
                white: '#FFFFFF',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
