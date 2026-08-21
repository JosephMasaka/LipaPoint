"use client";

import { useEffect, useState, useCallback } from "react";

export function LoadingBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const start = useCallback(() => {
    setVisible(true);
    setProgress(30);
  }, []);

  const done = useCallback(() => {
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
  }, []);

  useEffect(() => {
    const handleStart = () => start();
    const handleDone = () => done();

    window.addEventListener("pwa-loading-start", handleStart);
    window.addEventListener("pwa-loading-done", handleDone);
    return () => {
      window.removeEventListener("pwa-loading-start", handleStart);
      window.removeEventListener("pwa-loading-done", handleDone);
    };
  }, [start, done]);

  useEffect(() => {
    if (visible && progress < 90) {
      const t = setTimeout(() => setProgress((p) => Math.min(p + 10, 90)), 400);
      return () => clearTimeout(t);
    }
  }, [visible, progress]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[300] h-[2px] pointer-events-none">
      <div
        className="h-full bg-gold transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
