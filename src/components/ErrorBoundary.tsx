/**
 * Global Error Boundary Component
 * Catches and handles React component errors
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { errorLogger } from '@/lib/errorLogger';

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
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error
    errorLogger.logError({
      message: `React Error Boundary: ${error.message}`,
      stack: error.stack,
      name: error.name,
      severity: 'high',
      category: 'ui',
      tags: ['react-error-boundary'],
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'GlobalErrorBoundary',
      },
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

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
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
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

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

/**
 * Specialized Error Boundary for Form Components
 */
export class FormErrorBoundary extends Component<Props, State> {
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
      errorId: `form-error-${Date.now()}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    errorLogger.logError({
      message: `Form Error: ${error.message}`,
      stack: error.stack,
      severity: 'medium',
      category: 'ui',
      tags: ['form-error', 'react-error-boundary'],
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'FormErrorBoundary',
      },
    });

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

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
      return (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-destructive">
                Formular-Fehler
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Beim Laden des Formulars ist ein Fehler aufgetreten.
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={this.handleRetry}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Wiederholen
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Specialized Error Boundary for Auction Components
 */
export class AuctionErrorBoundary extends Component<Props, State> {
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
      errorId: `auction-error-${Date.now()}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    errorLogger.logError({
      message: `Auction Error: ${error.message}`,
      stack: error.stack,
      severity: 'high',
      category: 'business',
      tags: ['auction-error', 'react-error-boundary'],
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'AuctionErrorBoundary',
      },
    });

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

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
      return (
        <Card className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Auktions-Fehler</h3>
          <p className="text-muted-foreground mb-4">
            Die Auktionsdaten konnten nicht geladen werden.
          </p>
          <Button onClick={this.handleRetry} className="flex items-center gap-2 mx-auto">
            <RefreshCw className="h-4 w-4" />
            Erneut laden
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
