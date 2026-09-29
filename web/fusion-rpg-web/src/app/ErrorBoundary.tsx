import { Component, type ErrorInfo, type ReactNode } from "react";
import { Banner } from "@/ui";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crash", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Banner tone="error">
          UI crashed: {this.state.error.message}. Reload the page.
        </Banner>
      );
    }
    return this.props.children;
  }
}
