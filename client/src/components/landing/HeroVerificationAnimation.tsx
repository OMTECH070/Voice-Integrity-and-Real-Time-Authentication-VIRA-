import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { StaggeredHeadline } from "./StaggeredHeadline";
import heroPersonImg from "../../assets/landing/hero-person-clean.png";

/**
 * HeroVerificationAnimation
 *
 * Minimal, technical, editorial biometric hero animation:
 * - 8 delicate, ultra-thin waveform paths (stroke-width: ~0.65 - 0.85px)
 * - Begins AFTER the heading area (x >= 640), leaving heading completely clean
 * - Flows left-to-right into the static girl's facial contour
 * - Clean 16kHz SIGNAL STREAM technical label in open space between text and face
 * - Subtle head scan contour arcs
 * - Static girl anchor (opacity: 1, 100% natural proportions)
 */
export const HeroVerificationAnimation: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  // 8 refined, thin waveform paths in viewBox 0 0 1600 500
  // Every strand begins AFTER the heading area (x >= 640) and terminates cleanly at the face contour
  const strands = [
    // 01. Temple convergence strand
    {
      id: "strand-0",
      d: "M 670,175 C 780,165 920,175 1060,192 C 1120,200 1180,208 1236,215",
      width: 0.7,
      baseOpacity: 0.42,
      dash: undefined,
    },
    // 02. Forehead / upper brow strand
    {
      id: "strand-1",
      d: "M 655,195 C 770,185 910,192 1050,210 C 1120,218 1180,224 1228,226",
      width: 0.75,
      baseOpacity: 0.52,
      dash: "6 4",
    },
    // 03. Bridge of nose strand
    {
      id: "strand-2",
      d: "M 645,215 C 760,205 900,210 1040,225 C 1110,232 1170,235 1222,236",
      width: 0.8,
      baseOpacity: 0.58,
      dash: undefined,
    },
    // 04. MAIN CARRIER - Direct tip of nose
    {
      id: "strand-3",
      d: "M 640,235 C 750,228 890,230 1030,240 C 1100,244 1165,247 1215,248",
      width: 0.85,
      baseOpacity: 0.75,
      dash: "8 4",
    },
    // 05. Philtrum & upper lip
    {
      id: "strand-4",
      d: "M 640,255 C 750,250 890,248 1030,252 C 1100,254 1165,257 1220,258",
      width: 0.8,
      baseOpacity: 0.65,
      dash: undefined,
    },
    // 06. Mouth / speech aperture
    {
      id: "strand-5",
      d: "M 645,275 C 760,270 900,265 1040,265 C 1110,265 1170,266 1224,268",
      width: 0.75,
      baseOpacity: 0.55,
      dash: "5 4",
    },
    // 07. Chin crease
    {
      id: "strand-6",
      d: "M 655,295 C 770,290 910,282 1050,278 C 1120,276 1180,278 1232,280",
      width: 0.7,
      baseOpacity: 0.48,
      dash: undefined,
    },
    // 08. Tip of chin contour
    {
      id: "strand-7",
      d: "M 670,315 C 780,310 920,300 1060,292 C 1120,288 1180,290 1238,294",
      width: 0.65,
      baseOpacity: 0.40,
      dash: "6 5",
    },
  ];

  // Biometric head scan contour arcs surrounding the head profile
  const headScanArcs = [
    {
      id: "scan-arc-1",
      d: "M 1240,175 C 1260,105 1335,90 1415,105 C 1475,120 1515,170 1515,245 C 1515,315 1475,375 1415,400",
      width: 0.65,
      dash: "4 4",
    },
    {
      id: "scan-arc-2",
      d: "M 1225,160 C 1250,80 1335,65 1430,80 C 1500,95 1545,155 1545,245 C 1545,330 1500,398 1430,422",
      width: 0.55,
      dash: "6 4",
    },
    {
      id: "scan-arc-3",
      d: "M 1210,145 C 1240,55 1335,40 1445,55 C 1525,70 1575,140 1575,245 C 1575,345 1525,420 1445,445",
      width: 0.5,
      dash: "3 4",
    },
  ];

  return (
    <div className="hero-verification-animation-container">
      {/* 1. Full-Width Continuous Biometric Canvas */}
      <div className="hero-animation-canvas-wrap" aria-hidden="true">
        <svg
          className="hero-animation-svg"
          viewBox="0 0 1600 500"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            {/* Smooth linear gradient per strand - gently fades in from left origin */}
            {strands.map((s, i) => (
              <linearGradient
                key={`grad-${s.id}`}
                id={`bioStreamGrad-${i}`}
                gradientUnits="userSpaceOnUse"
                x1="640"
                y1="0"
                x2="1240"
                y2="0"
              >
                <stop offset="0%" stopColor="rgba(0, 0, 0, 0.05)" />
                <stop offset="12%" stopColor="rgba(0, 0, 0, 0.40)" />
                <stop offset="60%" stopColor="rgba(0, 0, 0, 0.65)" />
                <stop offset="95%" stopColor="rgba(0, 0, 0, 0.50)" />
                <stop offset="100%" stopColor="rgba(0, 0, 0, 0.20)" />
              </linearGradient>
            ))}

            {/* Scan arc gradient */}
            <linearGradient id="scanArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(0, 0, 0, 0.08)" />
              <stop offset="50%" stopColor="rgba(0, 0, 0, 0.35)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0.08)" />
            </linearGradient>
          </defs>

          {/* LAYER 1: Biometric Head Contour Arcs (Subtle thin monochrome SVG lines around head) */}
          <g className="biometric-head-scan-layer">
            {headScanArcs.map((arc, i) => (
              <motion.path
                key={arc.id}
                d={arc.d}
                stroke="url(#scanArcGrad)"
                strokeWidth={arc.width}
                strokeDasharray={arc.dash}
                strokeLinecap="round"
                fill="none"
                opacity={0.25}
                animate={
                  shouldReduceMotion
                    ? { opacity: 0.25 }
                    : {
                        strokeDashoffset: [0, 80],
                      }
                }
                transition={{
                  duration: 14 + i * 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}
          </g>

          {/* LAYER 2: 8 Thin Continuous Waveform Strands (Origin x >= 640 -> Face, permanently visible) */}
          <g className="waveform-strands-layer">
            {strands.map((s, i) => (
              <motion.path
                key={s.id}
                d={s.d}
                stroke={`url(#bioStreamGrad-${i})`}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinecap="round"
                fill="none"
                opacity={s.baseOpacity}
                animate={
                  shouldReduceMotion
                    ? { opacity: s.baseOpacity }
                    : {
                        strokeDashoffset: s.dash ? [0, -80] : undefined,
                        opacity: [s.baseOpacity, s.baseOpacity * 1.15, s.baseOpacity],
                      }
                }
                transition={{
                  duration: 6 + (i % 3) * 1.2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}
          </g>

          {/* LAYER 3: 16kHz SIGNAL STREAM Technical Pill (Cleanly in open space between text and face) */}
          <g className="signal-annotation-pill-group">
            <rect
              x="860"
              y="226"
              width="134"
              height="18"
              rx="3"
              fill="#ffffff"
              stroke="rgba(0, 0, 0, 0.22)"
              strokeWidth="0.8"
            />
            {/* Pulsing micro-status dot */}
            <motion.circle
              cx="870"
              cy="235"
              r="1.8"
              fill="#0a0a0a"
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: [0.35, 1, 0.35] }
              }
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            />
            <text
              x="878"
              y="238.5"
              fontSize="7.5"
              fontFamily="monospace"
              fill="#0a0a0a"
              fontWeight="700"
              letterSpacing="0.08em"
            >
              16kHz SIGNAL STREAM
            </text>
          </g>
        </svg>
      </div>

      {/* 2. Static Human Profile Anchor (Dedicated .hero-person wrapper with 100% natural proportions) */}
      <div className="hero-person">
        <img
          src={heroPersonImg}
          alt="Biometric voice profile"
          className="hero-person-img"
        />
      </div>

      {/* 3. Hero Editorial Text Block (Positioned above canvas at z-index 3) */}
      <div className="hero-verification-text-block">
        <StaggeredHeadline
          text={"A SEAMLESS\nVERIFICATION\nPIPELINE"}
          as="h2"
          className="landing-how-title"
        />
        <p className="landing-how-subtitle">
          Continuous identity evaluation from speech capture to real-time verification.
        </p>
      </div>
    </div>
  );
};

export default HeroVerificationAnimation;
