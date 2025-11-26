// @ts-nocheck
import React from 'react';

export function CheckeredBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base red background */}
      <div className="absolute inset-0 bg-[#8B1A1A]" />

      {/* Checkered pattern */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="checkerboard"
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            {/* Dark squares */}
            <rect x="0" y="0" width="40" height="40" fill="#6B1414" />
            <rect x="40" y="40" width="40" height="40" fill="#6B1414" />
            {/* Light squares */}
            <rect x="40" y="0" width="40" height="40" fill="#A52A2A" />
            <rect x="0" y="40" width="40" height="40" fill="#A52A2A" />
            {/* Grid lines */}
            <line
              x1="0"
              y1="40"
              x2="80"
              y2="40"
              stroke="#4A0E0E"
              strokeWidth="1"
            />
            <line
              x1="40"
              y1="0"
              x2="40"
              y2="80"
              stroke="#4A0E0E"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#checkerboard)" />
      </svg>

      {/* Gradient overlay for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />

      {/* Bottom gradient for character placement */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48"
        style={{
          background: 'linear-gradient(to top, #2D1B47 0%, transparent 100%)',
        }}
      />
    </div>
  );
}
