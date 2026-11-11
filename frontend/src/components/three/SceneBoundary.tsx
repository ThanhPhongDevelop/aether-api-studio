import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SceneBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface SceneBoundaryState {
  failed: boolean;
}

/** Keeps a WebGL failure (lost context, driver bug) from taking down the whole page. */
export class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('3D scene failed to render', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
