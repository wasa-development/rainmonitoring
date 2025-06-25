"use client";

import React, { useMemo } from 'react';

const RainAnimation = () => {
  const raindrops = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => {
      const style = {
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 2}s`,
        animationDuration: `${0.5 + Math.random() * 0.5}s`,
      };
      return <div key={i} className="raindrop" style={style} />;
    });
  }, []);

  return <div className="rain-container">{raindrops}</div>;
};

export default RainAnimation;
