interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-2xl font-display font-semibold text-ink">{title}</h2>
        <div className="h-px w-10 bg-gold mt-1.5 rounded" />
        {subtitle && <p className="text-sm text-slate mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
