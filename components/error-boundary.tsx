'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
          <p className="text-lg font-black">Algo deu errado</p>
          <pre className="max-w-xl whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-destructive">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            onClick={() => window.location.assign('/app')}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Voltar para Meus futebóis
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
