interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-purple text-white hover:bg-accent-dark shadow-sm disabled:opacity-40',
  secondary: 'bg-paper text-ink border border-divider hover:bg-surface hover:border-brand-cyan/50 disabled:opacity-40',
  ghost: 'bg-transparent text-slate hover:text-brand-purple hover:bg-accent-50 disabled:opacity-40',
  danger: 'bg-danger text-white hover:bg-red-800 shadow-sm disabled:opacity-40',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-md',
  md: 'px-5 py-2.5 text-sm font-semibold rounded-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-colors duration-150 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  )
}
