"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-6xl font-black text-danger">X</p>
      <h1 className="mt-4 font-display text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-mute">
        The model hit a rough patch. Try again — if it persists, the error has been logged.
      </p>
      <button onClick={reset} className="btn-accent mt-8">
        Try again
      </button>
    </div>
  );
}
