import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface MarqueeProps {
  children: React.ReactNode;
  speed?: number; // duration in seconds
  reverse?: boolean;
  pauseOnHover?: boolean;
  className?: string;
}

export const Marquee: React.FC<MarqueeProps> = ({
  children,
  speed = 28,
  reverse = false,
  pauseOnHover = true,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  if (shouldReduceMotion) {
    return (
      <div className={`editorial-marquee-wrap ${className}`} style={{ overflowX: "auto" }}>
        <div className="editorial-marquee-track">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`editorial-marquee-wrap ${className}`}
      onMouseEnter={() => pauseOnHover && setIsHovered(true)}
      onMouseLeave={() => pauseOnHover && setIsHovered(false)}
    >
      <motion.div
        className="editorial-marquee-track"
        animate={{
          x: reverse ? ["-50%", "0%"] : ["0%", "-50%"],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: speed,
        }}
        style={{
          animationPlayState: isHovered ? "paused" : "running",
        }}
      >
        <div className="editorial-marquee-content">{children}</div>
        <div className="editorial-marquee-content" aria-hidden="true">
          {children}
        </div>
      </motion.div>
    </div>
  );
};
