import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-error-bg flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-error" />
          </div>
          <h2 className="text-lg font-semibold text-content-primary mb-2">出了点问题</h2>
          <p className="text-sm text-content-secondary mb-4 max-w-md">
            {this.state.error?.message || "组件渲染时发生未知错误"}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm transition-colors"
          >
            <RefreshCw size={14} />
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
