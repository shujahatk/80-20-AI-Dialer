import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './MINETECH-UI-KIT/components/**/*.{js,ts,jsx,tsx}',
    './MINETECH-UI-KIT/layouts/**/*.{js,ts,jsx,tsx}',
    './MINETECH-UI-KIT/templates/**/*.{js,ts,jsx,tsx}',
    './MINETECH-UI-KIT/utils/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-secondary': 'var(--surface-secondary)',
        'surface-elevated': 'var(--surface-elevated)',
        'on-surface': 'var(--on-surface, var(--text-primary))',
        'on-surface-variant': 'var(--on-surface-variant, var(--text-secondary))',
        'on-surface-muted': 'var(--on-surface-muted, var(--text-muted))',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover, var(--primary))',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
          hover: 'var(--secondary-hover, var(--secondary))',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          surface: 'var(--accent-surface)',
        },
        success: {
          DEFAULT: 'var(--success)',
          surface: 'var(--success-surface)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          surface: 'var(--warning-surface)',
        },
        error: {
          DEFAULT: 'var(--error)',
          surface: 'var(--error-surface)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          hover: 'var(--sidebar-hover)',
          text: 'var(--sidebar-text)',
          border: 'var(--sidebar-border)',
          active: 'var(--sidebar-active)',
        },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          track: 'var(--chart-track)',
        },
        minetech: {
          clay: '#B43C1B',
          'clay-dark': '#922E13',
          'clay-light': '#DE643C',
          terracotta: '#C84C27',
          ochre: '#D97746',
          charcoal: '#161312',
          'charcoal-surface': '#1E1A19',
          'charcoal-elevated': '#262220',
          'warm-white': '#F7F5F2',
          stone: '#DFDBD6',
          'soft-surface': '#ECE9E5',
        },
        brand: {
          DEFAULT: '#2f5d50',
          50: '#FDF6F3',
          100: '#FCEFEA',
          200: '#F7D6CC',
          500: '#2f5d50',
          600: '#23463c',
          700: '#1c2824',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['var(--font-plus-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '0.75rem',
        xl: '0.625rem',
        lg: 'var(--radius, 0.5rem)',
        md: 'calc(var(--radius, 0.5rem) - 2px)',
        sm: 'calc(var(--radius, 0.5rem) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;

