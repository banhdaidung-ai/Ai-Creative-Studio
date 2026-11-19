import React, { useEffect, useState } from 'react';

interface ElapsedTimerProps {
  active: boolean;
  /** Optional custom formatter; defaults to `${seconds.toFixed(1)}s` */
  format?: (seconds: number) => React.ReactNode;
  className?: string;
}

/**
 * Isolated 100ms elapsed timer component so high-frequency ticks never
 * re-render parent studio workspaces containing heavy DOM trees & images.
 */
export const ElapsedTimer: React.FC<ElapsedTimerProps> = ({
  active,
  format,
  className,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      const resetId = window.setTimeout(() => setElapsed(0), 0);
      return () => window.clearTimeout(resetId);
    }

    const start = performance.now();
    const initId = window.setTimeout(() => setElapsed(0), 0);
    const id = window.setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 100);
    return () => {
      window.clearTimeout(initId);
      window.clearInterval(id);
    };
  }, [active]);

  const displayed = active ? elapsed : 0;

  return (
    <span className={className}>
      {format ? format(displayed) : `${displayed.toFixed(1)}s`}
    </span>
  );
};

export default ElapsedTimer;
