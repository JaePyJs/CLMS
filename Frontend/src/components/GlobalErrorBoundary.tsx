import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
    // TODO: Integrate with a logging service here
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                We apologize for the inconvenience. The application has
                encountered an unexpected error.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="text-left bg-slate-100 dark:bg-slate-900 p-4 rounded-md overflow-auto max-h-48 text-xs font-mono border border-slate-200 dark:border-slate-800">
                <p className="font-bold text-red-600 mb-2">
                  {this.state.error.toString()}
                </p>
                <pre className="whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button onClick={this.handleReload} size="lg" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
