import React from "react";
import { motion, Variants, useReducedMotion } from "framer-motion";

const EDITORIAL_EASE = [0.16, 1, 0.3, 1] as const;

interface StaggeredHeadlineProps {
  text: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  delay?: number;
}

const lineMaskContainer: Variants = {
  hidden: {},
  visible: (customDelay: number = 0) => ({
    transition: {
      staggerChildren: 0.12,
      delayChildren: customDelay,
    },
  }),
};

const lineMaskChild: Variants = {
  hidden: {
    y: "115%",
    opacity: 0.1,
    filter: "blur(4px)",
  },
  visible: {
    y: "0%",
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.75,
      ease: EDITORIAL_EASE,
    },
  },
};

export function StaggeredHeadline({
  text,
  as = "h2",
  className = "",
  delay = 0.15,
}: StaggeredHeadlineProps) {
  const Tag = motion[as];
  const shouldReduceMotion = useReducedMotion();

  // Split text by lines if \n is present, otherwise split words into lines naturally
  const lines = text.split("\n");

  if (shouldReduceMotion) {
    return (
      <Tag className={className}>
        {lines.map((line, idx) => (
          <React.Fragment key={idx}>
            {line}
            {idx < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </Tag>
    );
  }

  return (
    <Tag className={className}>
      <motion.span
        variants={lineMaskContainer}
        custom={delay}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: "some" }}
        style={{ display: "block" }}
      >
        {lines.map((line, lineIdx) => (
          <span
            key={lineIdx}
            className="headline-line-mask"
            style={{
              display: "block",
              overflow: "hidden",
              lineHeight: "1.15",
              paddingBottom: "0.08em",
            }}
          >
            <motion.span
              variants={lineMaskChild}
              style={{
                display: "block",
                transformOrigin: "bottom center",
                willChange: "transform, opacity",
              }}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

