import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onResetMode?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught UI error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleHardReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onResetMode) {
      this.props.onResetMode();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] w-full p-8 text-center">
          <div className="max-w-md w-full bg-white/80 dark:bg-[#141414]/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Đã xảy ra sự cố hiển thị
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Một lỗi không mong muốn vừa xảy ra trong phân hệ này. Dữ liệu lịch sử và dự án của bạn vẫn được bảo toàn an toàn.
              </p>
            </div>
            {this.state.error && (
              <details className="text-left bg-black/5 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl p-3">
                <summary className="text-[10px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer">
                  Chi tiết lỗi kỹ thuật
                </summary>
                <pre className="mt-2 text-[10px] font-mono text-red-500 dark:text-red-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Thử lại
              </button>
              <button
                onClick={this.handleHardReset}
                className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Home className="w-3.5 h-3.5" /> Về Tạo Ảnh
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
