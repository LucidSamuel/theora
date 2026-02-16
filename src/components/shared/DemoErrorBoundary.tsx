import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  demoName: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DemoErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center max-w-md">
            <div
              className="text-sm font-semibold mb-2"
              style={{ color: 'var(--status-error)' }}
            >
              {this.props.demoName} encountered an error
            </div>
            <p
              className="text-xs mb-4 font-mono"
              style={{ color: 'var(--text-muted)' }}
            >
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded text-xs font-medium btn-primary"
              style={{
                background: 'var(--button-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--button-border)',
                boxShadow: '0 6px 16px rgba(10, 8, 6, 0.18)',
              }}
            >
              Reset Demo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
