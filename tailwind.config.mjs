import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Atkinson', ...defaultTheme.fontFamily.sans],
      },
      typography: {
        DEFAULT: {
          css: {
            'code:not(pre code)': {
              backgroundColor: '#f3f4f6',
              color: '#eb4898',
              padding: '0.2em 0.4em',
              borderRadius: '0.375rem',
              fontWeight: '500',
              '&::before': { content: '"" !important' },
              '&::after': { content: '"" !important' },
            },
          },
        },
        invert: {
          css: {
            'code:not(pre code)': {
              backgroundColor: '#1e293b',
              color: '#f472b6',
              '&::before': { content: '"" !important' },
              '&::after': { content: '"" !important' },
            },
          },
        },
      },
      rotate: {
        45: '45deg',
        135: '135deg',
        225: '225deg',
        315: '315deg',
      },
      animation: {
        twinkle: 'twinkle 2s ease-in-out forwards',
        meteor: 'meteor 3s ease-in-out forwards',
      },
      keyframes: {
        twinkle: {
          '0%': {
            opacity: 0,
            transform: 'rotate(0deg)',
          },
          '50%': {
            opacity: 1,
            transform: 'rotate(180deg)',
          },
          '100%': {
            opacity: 0,
            transform: 'rotate(360deg)',
          },
        },
        meteor: {
          '0%': {
            opacity: 0,
            transform: 'translateY(200%)',
          },
          '50%': {
            opacity: 1,
          },
          '100%': {
            opacity: 0,
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
