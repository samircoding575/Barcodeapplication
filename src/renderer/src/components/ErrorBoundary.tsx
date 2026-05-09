import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[50vh] p-8">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center">
            <p className="text-red-700 font-semibold mb-2">Something went wrong</p>
            <p className="text-red-500 text-sm mb-6 font-mono break-all">{this.state.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
