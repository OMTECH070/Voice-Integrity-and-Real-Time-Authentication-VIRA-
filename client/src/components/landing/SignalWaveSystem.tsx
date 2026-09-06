import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * SignalWaveSystem
 * 
 * Visually replicates the reference design:
 * - Originates at the far LEFT edge (x = 0)
 * - Extends BEHIND the 3-line heading ("A SEAMLESS \n VERIFICATION \n PIPELINE")
 * - Features terminal nodes and signal bus bar at the left boundary
 * - Undulates with dynamic harmonic wave crests across the center
 * - Includes the technical "• 16kHz SIGNAL STREAM" annotation pill with leader
 * - Progressively CONVERGES directly into the person's nose / mouth / profile
 * - Subtly animated traveling signal pulses (Voice Signal -> Processing -> Identity)
 */
export const SignalWaveSystem: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  // 15 continuous waveform paths spanning x = 0 (left edge) to x ≈ 1285 (face profile)
  // in viewBox 0 0 1600 500
  const strands = [
    // 01. Top boundary strand with dramatic wave crest
    {
      id: "strand-0",
      d: "M 0,110 C 160,95 320,105 480,115 C 640,125 720,55 860,65 C 980,75 1120,165 1285,235",
      width: 0.8,
      opacity: 0.32,
      flowing: false,
      dash: undefined,
    },
    // 02. Upper harmonic line
    {
      id: "strand-1",
      d: "M 0,132 C 160,118 320,125 480,134 C 640,142 720,75 860,85 C 980,95 1120,175 1285,237",
      width: 0.85,
      opacity: 0.36,
      flowing: true,
      dash: "6 5",
    },
    // 03. Upper wave strand
    {
      id: "strand-2",
      d: "M 0,154 C 160,140 320,145 480,152 C 640,160 720,95 860,105 C 980,115 1120,185 1285,239",
      width: 0.9,
      opacity: 0.4,
      flowing: false,
      dash: undefined,
    },
    // 04. Upper acoustic line
    {
      id: "strand-3",
      d: "M 0,176 C 160,162 320,165 480,170 C 640,175 730,118 870,128 C 990,138 1130,195 1285,241",
      width: 0.95,
      opacity: 0.44,
      flowing: false,
      dash: undefined,
    },
    // 05. Upper carrier strand
    {
      id: "strand-4",
      d: "M 0,198 C 160,185 320,185 480,188 C 640,190 730,142 870,150 C 990,160 1130,205 1285,243",
      width: 1.0,
      opacity: 0.48,
      flowing: true,
      dash: "8 5",
    },
    // 06. Near-center upper carrier
    {
      id: "strand-5",
      d: "M 0,220 C 160,208 320,205 490,206 C 650,205 740,168 880,174 C 1000,182 1140,214 1285,245",
      width: 1.05,
      opacity: 0.54,
      flowing: false,
      dash: undefined,
    },
    // 07. Near-center upper wave
    {
      id: "strand-6",
      d: "M 0,244 C 160,230 320,224 500,224 C 660,220 750,195 880,198 C 1000,202 1140,222 1285,246",
      width: 1.15,
      opacity: 0.6,
      flowing: false,
      dash: undefined,
    },
    // 08. MAIN CARRIER WAVE (Direct center line with 16kHz annotation node)
    {
      id: "strand-7",
      d: "M 0,268 C 160,252 320,244 510,242 C 670,238 760,215 880,218 C 1010,222 1150,230 1285,247",
      width: 1.35,
      opacity: 0.72,
      flowing: true,
      dash: "10 5",
    },
    // 09. Near-center lower wave
    {
      id: "strand-8",
      d: "M 0,292 C 160,274 320,264 520,260 C 680,256 770,238 890,238 C 1020,238 1150,238 1285,248",
      width: 1.15,
      opacity: 0.6,
      flowing: false,
      dash: undefined,
    },
    // 10. Near-center lower carrier
    {
      id: "strand-9",
      d: "M 0,316 C 160,296 320,284 520,280 C 680,275 780,262 900,258 C 1030,252 1160,244 1285,250",
      width: 1.05,
      opacity: 0.54,
      flowing: true,
      dash: "7 4",
    },
    // 11. Lower carrier strand
    {
      id: "strand-10",
      d: "M 0,340 C 160,318 320,304 520,300 C 680,295 780,286 910,278 C 1040,268 1160,250 1285,252",
      width: 1.0,
      opacity: 0.48,
      flowing: false,
      dash: undefined,
    },
    // 12. Lower acoustic line
    {
      id: "strand-11",
      d: "M 0,364 C 160,340 320,324 520,320 C 680,315 790,310 920,298 C 1050,282 1170,256 1285,254",
      width: 0.95,
      opacity: 0.44,
      flowing: false,
      dash: undefined,
    },
    // 13. Lower wave strand
    {
      id: "strand-12",
      d: "M 0,388 C 160,362 320,344 520,340 C 680,335 800,334 930,318 C 1060,298 1180,262 1285,256",
      width: 0.9,
      opacity: 0.4,
      flowing: false,
      dash: undefined,
    },
    // 14. Lower harmonic line
    {
      id: "strand-13",
      d: "M 0,412 C 160,384 320,364 520,360 C 680,355 810,358 940,338 C 1070,312 1190,268 1285,258",
      width: 0.85,
      opacity: 0.36,
      flowing: true,
      dash: "6 5",
    },
    // 15. Bottom boundary strand
    {
      id: "strand-14",
      d: "M 0,435 C 160,406 320,384 520,380 C 680,375 820,382 950,358 C 1080,328 1200,274 1285,260",
      width: 0.8,
      opacity: 0.32,
      flowing: false,
      dash: undefined,
    },
  ];

  // Left-edge bus bar terminal pins (matching reference screenshot hardware nodes)
  const leftTerminalNodes = [132, 176, 220, 268, 316, 364, 412];

  // Subtle nodal dots along the center waveforms (as seen in reference design)
  const waveNodes = [
    { cx: 510, cy: 242, r: 2.2 },
    { cx: 640, cy: 190, r: 1.8 },
    { cx: 760, cy: 215, r: 2.0 },
    { cx: 680, cy: 275, r: 1.8 },
    { cx: 940, cy: 338, r: 1.8 },
    { cx: 1010, cy: 222, r: 2.0 },
    { cx: 1140, cy: 222, r: 1.8 },
  ];

  return (
    <div className="signal-wave-system-wrap" aria-hidden="true">
      <svg
        className="signal-wave-system-svg"
        viewBox="0 0 1600 500"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          {/* Subtle gradient for each strand: visible across whole width, soft at ends */}
          {strands.map((s, i) => (
            <linearGradient
              key={`grad-${s.id}`}
              id={`streamGrad-${i}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(0, 0, 0, 0.45)" />
              <stop offset="4%" stopColor="rgba(0, 0, 0, 0.38)" />
              <stop offset="25%" stopColor="rgba(0, 0, 0, 0.24)" />
              <stop offset="52%" stopColor="rgba(0, 0, 0, 0.52)" />
              <stop offset="80%" stopColor="rgba(0, 0, 0, 0.65)" />
              <stop offset="97%" stopColor="rgba(0, 0, 0, 0.35)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </linearGradient>
          ))}
        </defs>

        {/* 15 Full-Width Waveform Paths (from x = 0 through heading into face) */}
        {strands.map((s, i) => (
          <path
            key={s.id}
            d={s.d}
            stroke={`url(#streamGrad-${i})`}
            strokeWidth={s.width}
            strokeDasharray={s.dash}
            strokeLinecap="round"
            className={`wave-strand ${s.flowing && !shouldReduceMotion ? "wave-strand-flowing" : ""}`}
            opacity={s.opacity}
          />
        ))}

        {/* Left-Edge Signal Bus Bar & Terminal Nodes (Hardware Patch Visual) */}
        <g className="signal-bus-left-header">
          {/* Vertical linking bus lines */}
          <line
            x1="22"
            y1="130"
            x2="22"
            y2="415"
            stroke="rgba(0, 0, 0, 0.28)"
            strokeWidth="0.8"
          />
          {/* Circular terminal nodes */}
          {leftTerminalNodes.map((y, idx) => (
            <g key={`node-${idx}`}>
              <circle
                cx="22"
                cy={y}
                r="3.2"
                fill="#ffffff"
                stroke="#0a0a0a"
                strokeWidth="1.2"
              />
              <circle cx="22" cy={y} r="1.2" fill="#0a0a0a" />
            </g>
          ))}
        </g>

        {/* Small subtle circuit nodes on harmonic crossings (reference image detail) */}
        {waveNodes.map((node, i) => (
          <circle
            key={`wnode-${i}`}
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill="#ffffff"
            stroke="#0a0a0a"
            strokeWidth="1"
            opacity="0.65"
          />
        ))}

        {/* Traveling Acoustic Signal Packets (left edge -> heading -> center -> face) */}
        {!shouldReduceMotion && (
          <>
            {/* Main packet along Strand 7 (Center Carrier) */}
            <motion.circle
              r="2.6"
              fill="#0a0a0a"
              initial={{ cx: 20, cy: 268, opacity: 0 }}
              animate={{
                cx: [20, 510, 880, 1285],
                cy: [268, 242, 218, 247],
                opacity: [0, 0.9, 0.9, 0],
              }}
              transition={{
                duration: 3.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            {/* Upper harmonic packet along Strand 4 */}
            <motion.circle
              r="2.0"
              fill="#333333"
              initial={{ cx: 20, cy: 198, opacity: 0 }}
              animate={{
                cx: [20, 480, 870, 1285],
                cy: [198, 188, 150, 243],
                opacity: [0, 0.75, 0.75, 0],
              }}
              transition={{
                duration: 3.9,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.1,
              }}
            />
            {/* Lower harmonic packet along Strand 9 */}
            <motion.circle
              r="2.0"
              fill="#333333"
              initial={{ cx: 20, cy: 316, opacity: 0 }}
              animate={{
                cx: [20, 520, 900, 1285],
                cy: [316, 280, 258, 250],
                opacity: [0, 0.75, 0.75, 0],
              }}
              transition={{
                duration: 4.1,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2.0,
              }}
            />
          </>
        )}

        {/* Technical 16kHz SIGNAL STREAM Annotation Node (Center-Right Position) */}
        <g className="signal-annotation-pill">
          {/* Target reticle directly on carrier wave at (880, 218) */}
          <circle cx="880" cy="218" r="3.6" fill="#ffffff" stroke="#0a0a0a" strokeWidth="1.2" />
          <circle cx="880" cy="218" r="1.5" fill="#0a0a0a" />

          {/* Thin leader connector line */}
          <line
            x1="880"
            y1="222"
            x2="895"
            y2="258"
            stroke="rgba(0, 0, 0, 0.35)"
            strokeWidth="0.8"
          />

          {/* Pill Container */}
          <rect
            x="895"
            y="246"
            width="144"
            height="23"
            rx="4"
            fill="#ffffff"
            stroke="rgba(0, 0, 0, 0.24)"
            strokeWidth="1"
          />
          {/* Status Indicator Dot */}
          <circle cx="907" cy="257.5" r="2.4" fill="#0a0a0a" />

          {/* Monospace Annotation Text */}
          <text
            x="916"
            y="261.5"
            fontSize="9"
            fontFamily="monospace"
            fill="#0a0a0a"
            fontWeight="700"
            letterSpacing="0.06em"
          >
            16kHz SIGNAL STREAM
          </text>
        </g>
      </svg>
    </div>
  );
};

export default SignalWaveSystem;

