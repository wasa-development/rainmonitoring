import React from 'react';

/**
 * A component that renders an SVG logo representing the Punjab Water & Sanitation Authority.
 * This is a simplified vector representation of the official logo.
 */
export const Logo = ({ className, width = 64, height = 64 }: { className?: string, width?: number, height?: number }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Punjab Water & Sanitation Authority Logo"
    role="img"
  >
    <style>
      {`.logo-text { font-family: 'Arial', 'Helvetica', sans-serif; font-weight: bold; font-size: 13px; letter-spacing: 1px; fill: #0b3c5d; text-anchor: middle; }`}
    </style>
    <defs>
      {/* Path for the text to follow an arc at the bottom */}
      <path id="textArc" d="M 40 125 A 60 60 0 0 1 160 125" fill="none" />
      {/* Gradient for the water drop */}
      <linearGradient id="waterDropGradient" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="#29ABE2" />
        <stop offset="100%" stopColor="#1E88E5" />
      </linearGradient>
    </defs>
    
    {/* Outer C-shape swoosh */}
    <path
      d="M175,100 A75,75 0 1 1 25,100 C25,40 175,40 175,100 Z"
      fill="#1E88E5"
    />
    {/* Inner white circle to create the C-shape */}
    <circle cx="100" cy="100" r="60" fill="white" />
    
    {/* Green ground area */}
    <path
      d="M60,135 C80,125, 120,125, 140,135 L140,145 C120,155, 80,155, 60,145 Z"
      fill="#4CAF50"
    />

    {/* Water waves */}
    <path
      d="M55,130 C80,120, 120,140, 145,130"
      stroke="#29B6F6"
      strokeWidth="5"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M60,140 C85,130, 125,150, 150,140"
      stroke="#1E88E5"
      strokeWidth="5"
      fill="none"
      strokeLinecap="round"
    />

    {/* Central water drop */}
    <path
      d="M100,50 C60,80, 60,120, 100,140 C140,120, 140,80, 100,50 Z"
      fill="url(#waterDropGradient)"
    />
    {/* Highlight on the water drop */}
    <path
      d="M100,52 C85,80, 90,110, 100,138 C110,110, 115,80, 100,52 Z"
      fill="white"
      opacity="0.3"
    />

    {/* Text on the arc */}
    <text className="logo-text">
      <textPath href="#textArc" startOffset="50%">
        PUNJAB WATER & SANITATION AUTHORITY
      </textPath>
    </text>
  </svg>
);
