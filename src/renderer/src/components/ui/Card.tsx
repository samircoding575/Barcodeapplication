interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps): JSX.Element {
  return (
    <div className={`bg-paper rounded-2xl border border-divider shadow-card ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: CardProps): JSX.Element {
  return (
    <div className={`px-6 py-4 border-b border-divider ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }: CardProps): JSX.Element {
  return (
    <div className={`px-6 py-5 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }: CardProps): JSX.Element {
  return (
    <div className={`px-6 py-4 border-t border-divider ${className}`}>
      {children}
    </div>
  )
}
