import { Variants } from "framer-motion";

/**
 * Shared motion curve and timings inspired by okaydev.co
 * Strict editorial precision: snappy, smooth cubic-bezier easing
 */
export const EDITORIAL_EASE = [0.16, 1, 0.3, 1] as const;
export const FAST_EASE = [0.25, 1, 0.5, 1] as const;

/**
 * Hero Orchestrated Entrance Variant Tree
 * Sequence: Mesh (0-300ms) -> Headline cascade (300-700ms) -> Subtitle & CTA (700-900ms) -> Widget card spring (900-1200ms)
 */
export const heroContainerVariant: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.25,
    },
  },
};

export const heroWidgetVariant: Variants = {
  hidden: {
    opacity: 0,
    x: 40,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 18,
      delay: 0.65,
    },
  },
};

/**
 * Standard Fade-Up variant for section headers and content blocks
 */
export const fadeUpVariant: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: (customDelay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      delay: customDelay,
      ease: EDITORIAL_EASE,
    },
  }),
};

/**
 * Alternating scroll-in variants for cards (Step 3)
 * Odd cards: visual slides in from left while text fades up
 * Even cards: visual scales in from 0.92->1 while text fades up from below
 */
export const cardOddVariant: Variants = {
  hidden: {
    opacity: 0,
    x: -28,
    y: 12,
  },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.65,
      ease: EDITORIAL_EASE,
    },
  },
};

export const cardEvenVariant: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: EDITORIAL_EASE,
    },
  },
};

/**
 * Bullet point typewriter cue variant with 150ms stagger
 */
export const bulletContainerVariant: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

export const bulletItemVariant: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: EDITORIAL_EASE,
    },
  },
};

export const dashSlideVariant: Variants = {
  hidden: { opacity: 0, x: -14 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.35,
      ease: EDITORIAL_EASE,
    },
  },
};

/**
 * Instant/accessible fallback for prefers-reduced-motion
 */
export const reducedFadeUpVariant: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

/**
 * Fade-In variant for images, watermarks, and subtle accents
 */
export const fadeInVariant: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: (customDelay: number = 0) => ({
    opacity: 1,
    transition: {
      duration: 0.6,
      delay: customDelay,
      ease: EDITORIAL_EASE,
    },
  }),
};

/**
 * Stagger Container for lists, feature cards, and step sequences
 */
export const staggerContainerVariant: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

/**
 * Card hover transition (border brighten + subtle lift)
 */
export const cardHoverMotion = {
  whileHover: {
    y: -2,
    transition: { duration: 0.2, ease: FAST_EASE },
  },
};

/**
 * Primary CTA button hover/tap micro-interactions
 */
export const buttonMotion = {
  whileHover: {
    scale: 1.03,
    transition: { duration: 0.18, ease: FAST_EASE },
  },
  whileTap: {
    scale: 0.97,
    transition: { duration: 0.1 },
  },
};

/**
 * Secondary arrow link hover (arrow nudges right)
 */
export const arrowMotion = {
  initial: { x: 0 },
  hover: {
    x: 4,
    transition: { duration: 0.2, ease: EDITORIAL_EASE },
  },
};

