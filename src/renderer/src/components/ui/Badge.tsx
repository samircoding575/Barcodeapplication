interface BadgeProps {
  variant: 'success' | 'warning' | 'danger' | 'neutral'
  children: React.ReactNode
  className?: string
}

const variants: Record<BadgeProps['variant'], string> = {
  success: 'bg-emerald-50 text-success',
  warning: 'bg-amber-50 text-warning',
  danger: 'bg-red-50 text-danger',
  neutral: 'bg-surface text-slate',
}

export function Badge({ variant, children, className = '' }: BadgeProps): JSX.Element {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
