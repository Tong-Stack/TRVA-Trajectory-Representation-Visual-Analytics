import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

// Keeps trajectory playback running regardless of which left panel tab is open.
export function TrajectoryPlaybackEngine() {
  const { trajTimeline, trajPlayhead, trajIsPlaying, trajPlaybackSpeed, setTrajPlayhead, setTrajIsPlaying } =
    useAppStore();

  const playheadRef = useRef(trajPlayhead);
  useEffect(() => {
    playheadRef.current = trajPlayhead;
  }, [trajPlayhead]);

  useEffect(() => {
    const timelineLen = trajTimeline.length;
    if (!trajIsPlaying) return;
    if (timelineLen <= 1) return;

    let raf = 0;
    let last = performance.now();
    let carry = 0;

    const tick = (now: number) => {
      const dt = Math.max(0, now - last) / 1000;
      last = now;
      carry += dt * trajPlaybackSpeed;
      if (carry >= 1) {
        const step = Math.floor(carry);
        carry -= step;
        const next = Math.min(timelineLen - 1, playheadRef.current + step);
        setTrajPlayhead(next);
        if (next >= timelineLen - 1) {
          setTrajIsPlaying(false);
          return;
        }
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [setTrajIsPlaying, setTrajPlayhead, trajIsPlaying, trajPlaybackSpeed, trajTimeline.length]);

  return null;
}

