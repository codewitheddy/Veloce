import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Send error report to server endpoint
    this.logErrorToServer(error, errorInfo);
  }

  private async logErrorToServer(error: Error, errorInfo: ErrorInfo) {
    try {
      await fetch('/api/logs/client-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message || 'Unknown React Runtime Error',
          name: error.name || 'Error',
          stack: error.stack || '',
          componentStack: errorInfo.componentStack || '',
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Failed to log client error to server:', err);
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorDetails = `Error: ${error?.name} - ${error?.message}\nURL: ${window.location.href}\nTime: ${new Date().toISOString()}\n\nStack:\n${error?.stack}\n\nComponent Stack:\n${errorInfo?.componentStack}`;

    navigator.clipboard.writeText(errorDetails);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          id="error-boundary-wrapper"
          className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans"
        >
          <div 
            id="error-boundary-card"
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative"
          >
            <div className="relative z-10 space-y-6">
              {/* Header Icon & Title */}
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-950 border border-red-800 rounded-xl text-red-400 shrink-0">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-mono font-semibold uppercase tracking-wider text-red-300 bg-red-950 border border-red-850 rounded-full">
                      Application Exception
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-white mt-1.5 tracking-tight">
                    Something went wrong
                  </h1>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                    An unhandled error occurred in the component hierarchy. Our monitoring service has been notified automatically.
                  </p>
                </div>
              </div>

              {/* Error Summary Box */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-red-300 overflow-x-auto space-y-1">
                <p className="font-semibold text-red-400">
                  {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unexpected application failure'}
                </p>
                <p className="text-slate-500 text-[11px]">
                  Occurred at {new Date().toLocaleTimeString()} • URL: {window.location.pathname}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  id="error-boundary-retry-btn"
                  onClick={this.handleReset}
                  aria-label="Try restoring component"
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Restoring View
                </button>

                <button
                  id="error-boundary-reload-btn"
                  onClick={this.handleReload}
                  aria-label="Reload full application"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  Reload App
                </button>

                <button
                  id="error-boundary-copy-btn"
                  onClick={this.handleCopyError}
                  aria-label="Copy error trace details"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer ml-auto"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied Trace</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Details
                    </>
                  )}
                </button>
              </div>

              {/* Technical Details Collapsible */}
              <div className="border-t border-slate-800/80 pt-4">
                <button
                  id="error-boundary-toggle-details-btn"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  aria-label="Toggle technical stack trace details"
                  className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {this.state.showDetails ? 'Hide Stack Trace' : 'View Stack Trace'}
                </button>

                {this.state.showDetails && (
                  <div className="mt-3 bg-slate-950 border border-slate-800/90 rounded-xl p-4 font-mono text-[11px] text-slate-400 space-y-3 max-h-60 overflow-y-auto">
                    <div>
                      <p className="text-slate-300 font-semibold mb-1">Call Stack:</p>
                      <pre className="whitespace-pre-wrap text-slate-400 leading-relaxed break-all">
                        {this.state.error?.stack || 'No stack trace available.'}
                      </pre>
                    </div>
                    {this.state.errorInfo?.componentStack && (
                      <div className="border-t border-slate-900 pt-2">
                        <p className="text-slate-300 font-semibold mb-1">Component Tree Stack:</p>
                        <pre className="whitespace-pre-wrap text-slate-500 leading-relaxed break-all">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
