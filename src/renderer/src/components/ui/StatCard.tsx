interface StatCardProps {
  value: string | number
  label: string
  accent?: boolean
  className?: string
}

export function StatCard({ value, label, accent = false, className = '' }: StatCardProps): JSX.Element {
  return (
    <div className={`bg-paper border border-divider rounded-2xl p-5 text-center shadow-card ${className}`}>
      <p className={`text-3xl font-display font-semibold ${accent ? 'text-gold' : 'text-ink'}`}>
        {value}
      </p>
      <p className="text-xs text-slate mt-1.5 font-medium uppercase tracking-wide">{label}</p>
    </div>
  )
}
