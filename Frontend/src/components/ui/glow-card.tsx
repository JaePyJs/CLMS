import * as React from 'react';
import { cn } from '@/lib/utils';

export interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Primary glow color */
  glowColor?: string;
  /** Secondary glow color for gradient */
  glowColorSecondary?: string;
  /** Size of the glow spotlight */
  glowSize?: number;
  /** Border width */
  borderWidth?: number;
  /** Whether glow is enabled */
  enableGlow?: boolean;
  /** Whether 3D tilt effect is enabled */
  enableTilt?: boolean;
  /** Maximum tilt angle in degrees */
  maxTilt?: number;
  /** Whether to show glare effect */
  enableGlare?: boolean;
  /** Maximum glare opacity */
  maxGlare?: number;
}

/**
 * GlowCard - A premium card with:
 * - Mouse-tracking border glow
 * - 3D tilt effect following cursor
 * - Optional glare highlight
 */
const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  (
    {
      className,
      children,
      glowColor = '#3b82f6', // Blue-500 (matches primary)
      glowColorSecondary = '#06b6d4', // Cyan-500 (complementary)
      glowSize = 200,
      borderWidth = 2,
      enableGlow = true,
      enableTilt = true,
      maxTilt = 4, // Subtle, minimalistic tilt
      enableGlare = true,
      maxGlare = 0.08, // Very subtle glare
      ...props
    },
    ref
  ) => {
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = React.useState(false);
    const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
    const [glarePos, setGlarePos] = React.useState({ x: 50, y: 50 });

    React.useImperativeHandle(ref, () => cardRef.current!);

    const handleMouseMove = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Update mouse position for glow
        setMousePos({ x, y });

        // Calculate tilt angles
        if (enableTilt) {
          const tiltX = ((y - centerY) / centerY) * -maxTilt;
          const tiltY = ((x - centerX) / centerX) * maxTilt;
          setTilt({ x: tiltX, y: tiltY });
        }

        // Calculate glare position
        if (enableGlare) {
          const glareX = (x / rect.width) * 100;
          const glareY = (y / rect.height) * 100;
          setGlarePos({ x: glareX, y: glareY });
        }
      },
      [enableTilt, enableGlare, maxTilt]
    );

    const handleMouseEnter = React.useCallback(() => {
      setIsHovered(true);
    }, []);

    const handleMouseLeave = React.useCallback(() => {
      setIsHovered(false);
      // Reset tilt smoothly
      setTilt({ x: 0, y: 0 });
    }, []);

    // Calculate transform style - subtle, minimalistic
    const transformStyle: React.CSSProperties = enableTilt
      ? {
          transform: isHovered
            ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
            : 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
          transition: isHovered
            ? 'transform 150ms ease-out'
            : 'transform 500ms ease-out',
        }
      : {};

    return (
      <div
        ref={cardRef}
        className={cn(
          'relative rounded-xl bg-card text-card-foreground',
          enableTilt && 'will-change-transform',
          className
        )}
        style={transformStyle}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* Border glow - follows cursor position on edges */}
        {enableGlow && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `
                radial-gradient(
                  ${glowSize}px circle at ${mousePos.x}px ${mousePos.y}px,
                  ${glowColor},
                  ${glowColorSecondary} 40%,
                  transparent 70%
                )
              `,
              WebkitMask: `
                linear-gradient(#fff 0 0) content-box, 
                linear-gradient(#fff 0 0)
              `,
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: `${borderWidth}px`,
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
          />
        )}

        {/* Glare effect - subtle light reflection */}
        {enableGlare && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{
              background: `
                radial-gradient(
                  circle at ${glarePos.x}% ${glarePos.y}%,
                  rgba(255, 255, 255, ${maxGlare}),
                  transparent 50%
                )
              `,
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
          />
        )}

        {/* Static subtle border */}
        <div className="absolute inset-0 rounded-xl pointer-events-none border border-white/10" />

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

GlowCard.displayName = 'GlowCard';

export { GlowCard };
