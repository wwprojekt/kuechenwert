/**
 * Global Error Boundary Component
 * Catches and handles React component errors
 * Logs all errors to Supabase error_logs table for admin dashboard
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logErrorToSupabase } from '@/lib/errorLogService';
import { getPageTitle } from '@/lib/germanErrors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logErrorToSupabase({
      errorCode: 'UI_REACT_ERROR_BOUNDARY',
      errorMessage: 'Ein unerwarteter Fehler ist aufgetreten. Unser Team wurde automatisch benachrichtigt.',
      errorCategory: 'ui',
      severity: 'critical',
      pagePath: window.location.pathname,
      pageTitle: getPageTitle(window.location.pathname),
      componentName: 'ErrorBoundary',
      originalError: error.message,
      stackTrace: error.stack,
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'GlobalErrorBoundary',
      },
    });

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full p-6 text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Etwas ist schiefgelaufen
              </h1>
              <p className="text-muted-foreground">
                Es tut uns leid, aber es ist ein unerwarteter Fehler aufgetreten.
                Unser Team wurde automatisch benachrichtigt.
              </p>
            </div>

            {this.props.showDetails && this.state.error && (
              <details className="text-left bg-muted p-3 rounded text-sm">
                <summary className="cursor-pointer font-medium mb-2">
                  Technische Details
                </summary>
                <div className="space-y-2">
                  <div>
                    <strong>Fehler:</strong> {this.state.error.message}
                  </div>
                  {this.state.errorId && (
                    <div>
                      <strong>Fehler-ID:</strong> {this.state.errorId}
                    </div>
                  )}
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className="text-xs mt-1 overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={this.handleRetry}
                variant="default"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Erneut versuchen
              </Button>
              
              <Button 
                onClick={this.handleGoHome}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Zur Startseite
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Wenn das Problem weiterhin besteht, kontaktieren Sie bitte unseren Support.
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
