interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-divider flex items-center justify-center mb-4">
        <span className="text-slate text-xl">—</span>
      </div>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-slate mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
