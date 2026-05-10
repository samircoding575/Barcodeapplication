interface StatCardProps {
  value: string | number
  label: string
  accent?: boolean
  className?: string
}

export function StatCard({ value, label, accent = false, className = '' }: StatCardProps): JSX.Element {
  return (
    <div className={`bg-paper border border-divider rounded-xl p-5 text-center shadow-sm transition-colors duration-150 group ${className}`}>
      <p className={`text-3xl font-display font-bold ${accent ? 'text-brand-purple' : 'text-ink'}`}>
        {value}
      </p>
      <p className="text-xs text-slate mt-1.5 font-semibold uppercase tracking-wide group-hover:text-ink transition-colors duration-150">{label}</p>
    </div>
  )
}
