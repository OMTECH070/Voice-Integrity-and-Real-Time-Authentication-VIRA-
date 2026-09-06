import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  magneticRadius?: number;
  magneticStrength?: number;
  onClick?: () => void;
  href?: string;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = "",
  magneticRadius = 14,
  magneticStrength = 0.35,
  onClick,
  href,
  ...rest
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Soft snappy spring physics matching editorial precision
  const springConfig = { damping: 16, stiffness: 180, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (shouldReduceMotion || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distanceX = (e.clientX - centerX) * magneticStrength;
    const distanceY = (e.clientY - centerY) * magneticStrength;

    // Clamp offset to magneticRadius
    const clampedX = Math.max(-magneticRadius, Math.min(magneticRadius, distanceX));
    const clampedY = Math.max(-magneticRadius, Math.min(magneticRadius, distanceY));

    x.set(clampedX);
    y.set(clampedY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  if (shouldReduceMotion) {
    return (
      <button
        ref={buttonRef}
        className={`btn-primary ${className}`}
        onClick={handleClick}
        {...rest}
      >
        {children}
      </button>
    );
  }

  return (
    <motion.button
      ref={buttonRef}
      className={`btn-primary ${className}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        x: springX,
        y: springY,
      }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
};
