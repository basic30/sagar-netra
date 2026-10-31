import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-900/90 rounded-2xl border border-red-500/30 m-4 shadow-xl">
          <AlertTriangle className="w-9 h-9 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">Unable to display this view</h3>
          <p className="text-[11px] text-slate-400 max-w-md font-mono">
            {this.state.error?.message || "An unexpected rendering issue occurred."}
          </p>
          <button
            onClick={this.handleReset}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Dashboard</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
