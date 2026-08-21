"use client";

import { useEffect, useState, useRef } from "react";

export function LoadingBar() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let activeRequests = 0;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      const isApi = url.startsWith("/api/");

      if (isApi) {
        activeRequests++;
        if (activeRequests === 1) {
          setLoading(true);
          setProgress(10);
        }
      }

      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        if (isApi) {
          activeRequests--;
          if (activeRequests === 0) {
            setProgress(100);
            setTimeout(() => {
              setLoading(false);
              setProgress(0);
            }, 300);
          }
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (loading && progress < 90) {
      timer.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p;
          return p + Math.random() * 10;
        });
      }, 500);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [loading, progress]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[300] h-[2px]">
      <div
        className="h-full bg-gold transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
