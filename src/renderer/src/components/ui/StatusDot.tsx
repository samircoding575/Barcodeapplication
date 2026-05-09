interface StatusDotProps {
  status: 'graded' | 'pending' | 'conflict'
  className?: string
  pulse?: boolean
}

const styles: Record<StatusDotProps['status'], string> = {
  graded: 'bg-success',
  pending: 'bg-transparent border-2 border-slate',
  conflict: 'bg-warning',
}

export function StatusDot({ status, className = '', pulse = false }: StatusDotProps): JSX.Element {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${styles[status]} ${pulse ? 'animate-pulse' : ''} ${className}`}
      aria-label={status}
    />
  )
}
