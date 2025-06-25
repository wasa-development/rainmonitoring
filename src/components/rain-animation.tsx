"use client";

import React, { useState, useEffect } from 'react';

const RainAnimation = () => {
  const [raindrops, setRaindrops] = useState<JSX.Element[]>([]);

  useEffect(() => {
    const generateRaindrops = () => {
      return Array.from({ length: 50 }).map((_, i) => {
        const style = {
          left: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${0.5 + Math.random() * 0.5}s`,
        };
        return <div key={i} className="raindrop" style={style} />;
      });
    };
    
    setRaindrops(generateRaindrops());
  }, []); 

  return <div className="rain-container">{raindrops}</div>;
};

export default RainAnimation;
