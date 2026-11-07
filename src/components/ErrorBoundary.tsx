import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Current News ErrorBoundary]: Caught unhandled UI error:', error, errorInfo);
  }

  private handleReload = () => {
    try {
      sessionStorage.clear();
    } catch {}
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-slate-100 font-sans">
          <div className="max-w-md w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-lg">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-xl">
              !
            </div>
            <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-2">
              Current News Live
            </h1>
            <p className="text-xs text-slate-500 font-mono mb-4">
              Editorial Feed Synchronization Notice
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              A temporary display synchronization issue occurred while rendering the latest dispatches. Please refresh to load the live news feed.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-150 dark:text-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
            >
              Reload Live News Feed
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
