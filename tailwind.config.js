/** @type {import('tailwindcss').Config} */
export default {
  content: ['./frontend/index.html', './frontend/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 低饱和强调色（中性后台风），仅用于主操作/选中态
        brand: {
          50: '#f3f6f8',
          100: '#e3e9ed',
          200: '#c6d2da',
          300: '#9fb1bd',
          400: '#74899a',
          500: '#52677a',
          600: '#3f5061',
          700: '#344250',
          800: '#2d3944',
          900: '#28323b',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
}
