"use client";
import React, { useEffect, useMemo, useState } from "react";

type Star = {
  top: number;
  left: number;
  size: number;     // px
  delay: number;    // sec
  duration: number; // sec
  opacity: number;  // base brightness
};

export type StarfieldProps = {
  count?: number;
  sizeRange?: [number, number];
  durationRange?: [number, number];
  maxDelay?: number;
  color?: string;
  className?: string;
};

export default function Starfield({
  count = 140,
  sizeRange = [1, 2.4],
  durationRange = [1.8, 4.2],
  maxDelay = 5,
  color = "#ffffff",
  className,
}: StarfieldProps) {
  const [stars, setStars] = useState<Star[] | null>(null);

  // destructure arrays into primitives so deps are stable
  const [minSize, maxSize] = sizeRange;
  const [minDur,  maxDur ] = durationRange;

  // generate function does NOT go in deps by identity
  const generate = useMemo(() => {
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;
    return () =>
      Array.from({ length: count }, () => ({
        top: rand(0, 100),
        left: rand(0, 100),
        size: rand(minSize, maxSize),
        delay: rand(0, maxDelay),
        duration: rand(minDur, maxDur),
        opacity: rand(0.4, 1),
      }));
  }, [count, minSize, maxSize, minDur, maxDur, maxDelay]);

  // run once on mount and whenever primitive props actually change
  useEffect(() => {
    setStars(generate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, minSize, maxSize, minDur, maxDur, maxDelay]);

  return (
    <div className={`starfield-layer ${className ?? ""}`} aria-hidden="true">
      {stars?.map((s, i) => (
        <span
          key={i}
          className="star-dot"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
            opacity: s.opacity,
            background: color,
          }}
        />
      ))}
    </div>
  );
}
