"use client";

import { useEffect } from "react";

/** Bottom toast matching spikes/ui-prototype (private dice rolls, etc.). */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
