import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useInView, useMotionValue, useTransform, animate } from "framer-motion";

const EDITORIAL_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Animated number counter that triggers on scroll into view
 */
export const AnimatedCounter: React.FC<{
  from?: number;
  to: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}> = ({ from = 0, to, duration = 1.2, decimals = 0, suffix = "", prefix = "" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const motionVal = useMotionValue(from);
  const rounded = useTransform(motionVal, (latest) =>
    `${prefix}${latest.toFixed(decimals)}${suffix}`
  );
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (inView && !shouldReduceMotion) {
      const controls = animate(motionVal, to, {
        duration,
        ease: [0.16, 1, 0.3, 1],
      });
      return controls.stop;
    } else if (inView && shouldReduceMotion) {
      motionVal.set(to);
    }
  }, [inView, to, duration, shouldReduceMotion, motionVal]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
};

/**
 * FIX 1 (ISSUE 2): PipelineSignalBridge
 * Rebuilt as a multi-strand acoustic waveform (7 overlapping sine/harmonic strands).
 * It originates near the text block (left side) as subtle, sparse carrier lines and
 * gradually increases in amplitude and visual density as it travels across to the ear photo,
 * seamlessly dissolving into the frequency wave visualization on the face.
 * Animated on scroll left-to-right with staggered pathLength reveal.
 */
export const PipelineSignalBridge: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  // 7 distinct acoustic wave strands with increasing harmonic frequency & amplitude
  const strands = [
    {
      d: "M 10,110 C 180,110 280,75 420,90 C 560,105 680,140 820,110 C 890,95 940,112 995,110",
      width: 1.3,
      opacity: 0.5,
      dash: undefined,
      gradId: "strandGrad1",
    },
    {
      d: "M 15,102 C 160,102 260,55 380,70 C 500,85 600,45 740,78 C 840,102 920,62 995,95",
      width: 1.0,
      opacity: 0.42,
      dash: undefined,
      gradId: "strandGrad2",
    },
    {
      d: "M 15,118 C 160,118 260,145 380,130 C 500,115 620,160 760,138 C 850,118 920,158 995,125",
      width: 1.0,
      opacity: 0.42,
      dash: undefined,
      gradId: "strandGrad3",
    },
    {
      d: "M 20,95 C 190,95 310,38 450,52 C 580,68 670,28 800,56 C 880,74 940,38 995,80",
      width: 0.85,
      opacity: 0.35,
      dash: undefined,
      gradId: "strandGrad4",
    },
    {
      d: "M 20,125 C 190,125 310,162 450,148 C 580,132 670,178 800,158 C 880,142 940,178 995,140",
      width: 0.85,
      opacity: 0.35,
      dash: undefined,
      gradId: "strandGrad5",
    },
    {
      d: "M 10,108 C 220,108 340,118 480,92 C 600,68 720,128 850,88 C 920,68 960,105 995,105",
      width: 0.9,
      opacity: 0.4,
      dash: "3 3",
      gradId: "strandGrad6",
    },
    {
      d: "M 25,110 C 240,110 360,62 500,112 C 640,158 760,42 880,122 C 940,162 970,108 995,115",
      width: 0.75,
      opacity: 0.3,
      dash: "5 4",
      gradId: "strandGrad7",
    },
  ];

  return (
    <div className="pipeline-signal-bridge-wrap" aria-hidden="true">
      <svg
        className="pipeline-signal-bridge-svg"
        viewBox="0 0 1000 220"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="strandGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.05)" />
            <stop offset="40%" stopColor="rgba(0, 0, 0, 0.28)" />
            <stop offset="80%" stopColor="rgba(0, 0, 0, 0.48)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.2)" />
          </linearGradient>
          <linearGradient id="strandGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.03)" />
            <stop offset="35%" stopColor="rgba(0, 0, 0, 0.22)" />
            <stop offset="75%" stopColor="rgba(0, 0, 0, 0.42)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.15)" />
          </linearGradient>
          <linearGradient id="strandGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.03)" />
            <stop offset="35%" stopColor="rgba(0, 0, 0, 0.22)" />
            <stop offset="75%" stopColor="rgba(0, 0, 0, 0.42)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.15)" />
          </linearGradient>
          <linearGradient id="strandGrad4" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.02)" />
            <stop offset="45%" stopColor="rgba(0, 0, 0, 0.18)" />
            <stop offset="85%" stopColor="rgba(0, 0, 0, 0.38)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.12)" />
          </linearGradient>
          <linearGradient id="strandGrad5" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.02)" />
            <stop offset="45%" stopColor="rgba(0, 0, 0, 0.18)" />
            <stop offset="85%" stopColor="rgba(0, 0, 0, 0.38)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.12)" />
          </linearGradient>
          <linearGradient id="strandGrad6" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.02)" />
            <stop offset="50%" stopColor="rgba(0, 0, 0, 0.24)" />
            <stop offset="90%" stopColor="rgba(0, 0, 0, 0.44)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.15)" />
          </linearGradient>
          <linearGradient id="strandGrad7" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.01)" />
            <stop offset="50%" stopColor="rgba(0, 0, 0, 0.16)" />
            <stop offset="90%" stopColor="rgba(0, 0, 0, 0.32)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.1)" />
          </linearGradient>
        </defs>

        {/* 7 Staggered animated harmonic wave strands */}
        {strands.map((s, i) => (
          <motion.path
            key={i}
            d={s.d}
            stroke={`url(#${s.gradId})`}
            strokeWidth={s.width}
            strokeDasharray={s.dash}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: s.opacity }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 1.35,
              ease: EDITORIAL_EASE,
              delay: 0.08 + i * 0.05,
            }}
          />
        ))}

        {/* Traveling acoustic signal pulses flowing left to right */}
        {!shouldReduceMotion && (
          <>
            <motion.circle
              r="2.5"
              fill="#0a0a0a"
              initial={{ cx: 30, cy: 110, opacity: 0 }}
              animate={{
                cx: [30, 500, 990],
                cy: [110, 90, 110],
                opacity: [0, 0.9, 0],
              }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.circle
              r="2"
              fill="#525252"
              initial={{ cx: 20, cy: 102, opacity: 0 }}
              animate={{
                cx: [20, 480, 990],
                cy: [102, 70, 95],
                opacity: [0, 0.7, 0],
              }}
              transition={{
                duration: 3.0,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.9,
              }}
            />
            <motion.circle
              r="2"
              fill="#737373"
              initial={{ cx: 20, cy: 118, opacity: 0 }}
              animate={{
                cx: [20, 500, 990],
                cy: [118, 130, 125],
                opacity: [0, 0.7, 0],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.6,
              }}
            />
          </>
        )}

        {/* Embedded Telemetry Tag Aligned Directly on Center Wave Strand */}
        <g className="signal-bridge-nodes">
          <circle cx="500" cy="90" r="3.5" fill="#ffffff" stroke="#0a0a0a" strokeWidth="1.4" />
          <rect
            x="510"
            y="79"
            width="140"
            height="20"
            rx="3"
            fill="#ffffff"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="1"
          />
          <text
            x="518"
            y="93"
            fontSize="8.5"
            fontFamily="monospace"
            fill="#0a0a0a"
            fontWeight="700"
            letterSpacing="0.04em"
          >
            16kHz SIGNAL STREAM
          </text>
        </g>
      </svg>
    </div>
  );
};

/**
 * FIX 2: BiometricTelemetryCard
 * Architectural supporting callout panel below the fingerprint-profile image in Core Capabilities.
 * Fills the left column dead space and sits inside the bounded sticky container.
 */
export const BiometricTelemetryCard: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  const coords = [
    { label: "DIM_001", val: "+0.842", active: true },
    { label: "DIM_048", val: "-0.193", active: false },
    { label: "DIM_096", val: "+0.912", active: true },
    { label: "DIM_144", val: "+0.455", active: true },
    { label: "DIM_192", val: "-0.720", active: false },
    { label: "SPEECH_GATE", val: "ACTIVE", active: true },
  ];

  return (
    <motion.div
      className="biometric-telemetry-card"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: EDITORIAL_EASE }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="telemetry-card-header">
        <div className="telemetry-title-row">
          <motion.span
            className="telemetry-pulse-dot"
            animate={shouldReduceMotion ? {} : { scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
          <span className="telemetry-title">192-DIM ACOUSTIC EMBEDDING</span>
        </div>
        <span className="telemetry-badge">LIVE BASELINE</span>
      </div>

      <div className="telemetry-vector-grid">
        {coords.map((c, i) => (
          <div key={i} className={`telemetry-vector-cell ${c.active ? "highlight" : ""}`}>
            <span className="cell-label">{c.label}</span>
            <span className="cell-val">{c.val}</span>
          </div>
        ))}
      </div>

      <div className="telemetry-meter-row">
        <div className="telemetry-meter-label">
          <span>COSINE CONFIDENCE</span>
          <strong>0.984 MATCH</strong>
        </div>
        <div className="telemetry-meter-track">
          <motion.div
            className="telemetry-meter-fill"
            initial={{ width: "0%" }}
            whileInView={{ width: "98.4%" }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.1, ease: EDITORIAL_EASE }}
          />
        </div>
      </div>

      <div className="telemetry-card-footer">
        <div className="footer-stat">
          <span className="stat-num">&lt; 14ms</span>
          <span className="stat-label">Inference Latency</span>
        </div>
        <div className="footer-stat">
          <span className="stat-num">0.012</span>
          <span className="stat-label">Vocoder Residual</span>
        </div>
        <div className="footer-stat">
          <span className="stat-num">AES-256</span>
          <span className="stat-label">SRTP Encrypted</span>
        </div>
      </div>
    </motion.div>
  );
};

export const VectorMatrixVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const nodes = [
    { x: 20, y: 30, val: "+0.842" },
    { x: 50, y: 15, val: "-0.193" },
    { x: 80, y: 35, val: "+0.912" },
    { x: 35, y: 65, val: "+0.455" },
    { x: 70, y: 75, val: "-0.720" },
    { x: 85, y: 55, val: "+0.618" },
    { x: 15, y: 70, val: "-0.311" },
  ];

  return (
    <motion.div
      className="mini-visual-box vector-matrix-box"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="mini-visual-label">192-DIM ACOUSTIC EMBEDDING</div>
      <svg className="mini-visual-svg" viewBox="0 0 100 90">
        <polyline
          points="20,30 50,15 80,35 85,55 70,75 35,65 15,70 20,30 35,65 80,35"
          fill="none"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="0.75"
          strokeDasharray="2 2"
        />
        {nodes.map((n, i) => (
          <g key={i}>
            <motion.circle
              cx={n.x}
              cy={n.y}
              r="2.5"
              fill="#0a0a0a"
              animate={shouldReduceMotion ? {} : { r: [2.5, 3.5, 2.5] }}
              transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.3 }}
            />
            <text
              x={n.x + 3.5}
              y={n.y + 1.5}
              fontSize="3.2"
              fontFamily="monospace"
              fill="#6b6b6b"
              fontWeight="600"
            >
              {n.val}
            </text>
          </g>
        ))}
      </svg>
    </motion.div>
  );
};

export const SpectrogramVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const bars = [18, 42, 68, 85, 92, 74, 55, 38, 22, 60, 88, 95, 78, 48, 30, 65, 82, 40];

  return (
    <motion.div
      className="mini-visual-box spectrogram-box"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="mini-visual-label">16KHZ AASIST SPECTRAL BINS</div>
      <div className="spectrogram-bars-row">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="spectrogram-bar"
            style={{ height: `${h}%` }}
            animate={
              shouldReduceMotion
                ? {}
                : {
                    height: [`${h * 0.6}%`, `${h}%`, `${h * 0.4}%`, `${h}%`],
                  }
            }
            transition={{
              repeat: Infinity,
              duration: 1.6,
              delay: (i % 6) * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <div className="mini-visual-meta">
        <span>0 Hz</span>
        <span>AASIST SYNTHESIS RESIDUAL: 0.012 (LIVE)</span>
        <span>8 kHz</span>
      </div>
    </motion.div>
  );
};

export const CosineMatchVisual: React.FC = () => {
  return (
    <motion.div
      className="mini-visual-box cosine-match-box"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="mini-visual-label">ECAPA-TDNN SPEAKER COSINE SIMILARITY</div>
      <div className="cosine-gauge-track">
        <div className="cosine-threshold-line" style={{ left: "85%" }}>
          <span className="threshold-tag">0.85 THRESHOLD</span>
        </div>
        <motion.div
          className="cosine-fill-bar"
          initial={{ width: "0%" }}
          whileInView={{ width: "98.2%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: EDITORIAL_EASE }}
        />
      </div>
      <div className="cosine-score-row">
        <span className="score-val">0.982</span>
        <span className="score-status">MATCH (ENROLLED CONTACT)</span>
      </div>
    </motion.div>
  );
};

export const RollingBufferVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="mini-visual-box rolling-buffer-box"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="mini-visual-label">3.0S SPEECH WINDOW / 1.5S OVERLAP HOP</div>
      <div className="buffer-windows-track">
        <div className="buffer-block buffer-1">
          <span>Window 0 (0.0s – 3.0s)</span>
        </div>
        <div className="buffer-block buffer-2">
          <span>Window 1 (1.5s – 4.5s)</span>
        </div>
        <motion.div
          className="buffer-block buffer-3 active"
          animate={shouldReduceMotion ? {} : { opacity: [0.85, 1, 0.85] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        >
          <span>Window 2 (3.0s – 6.0s) [Active]</span>
        </motion.div>
      </div>
      <div className="mini-visual-meta">
        <span>5-WINDOW TEMPORAL SMOOTHING ACTIVE</span>
      </div>
    </motion.div>
  );
};

export const EncryptedMeshVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="mini-visual-box encrypted-mesh-box"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="mini-visual-label">DIRECT WEBRTC DTLS / SRTP ENCRYPTED TUNNEL</div>
      <div className="mesh-nodes-diagram">
        <div className="mesh-peer-badge">CLIENT A (LOCAL)</div>
        <div className="mesh-tunnel-line">
          <motion.span
            className="mesh-lock-badge"
            animate={shouldReduceMotion ? {} : { scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          >
            🔒 AES-256 SRTP
          </motion.span>
        </div>
        <div className="mesh-peer-badge">CLIENT B (REMOTE)</div>
      </div>
      <div className="mini-visual-meta">
        <span>PEER-TO-PEER MEDIA • ZERO SERVER AUDIO LOGGING</span>
      </div>
    </motion.div>
  );
};

export const VadGateVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="mini-visual-box vad-gate-box"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="mini-visual-label">AUDIOWORKLET DSP SPEECH GATING</div>
      <div className="vad-envelope-graph">
        <div className="vad-noise-floor-line" />
        <svg className="vad-wave-svg" viewBox="0 0 100 30" preserveAspectRatio="none">
          <motion.path
            d="M0,15 Q10,14 20,15 T35,15 Q40,3 45,27 T55,5 T65,25 T75,15 Q85,15 100,15"
            fill="none"
            stroke="#0a0a0a"
            strokeWidth="1.2"
            animate={
              shouldReduceMotion
                ? {}
                : {
                    d: [
                      "M0,15 Q10,14 20,15 T35,15 Q40,3 45,27 T55,5 T65,25 T75,15 Q85,15 100,15",
                      "M0,15 Q10,16 20,15 T35,15 Q40,6 45,24 T55,8 T65,22 T75,15 Q85,15 100,15",
                      "M0,15 Q10,14 20,15 T35,15 Q40,3 45,27 T55,5 T65,25 T75,15 Q85,15 100,15",
                    ],
                  }
            }
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
        </svg>
      </div>
      <div className="mini-visual-meta">
        <span>NOISE (SILENCED)</span>
        <span className="speech-active-tag">SPEECH CONFIRMED</span>
        <span>HANGOVER (ACTIVE)</span>
      </div>
    </motion.div>
  );
};

/**
 * FIX 3b: Dedicated Micro-Visual for AASIST Tech Card
 * Features:
 * - Scroll-triggered entrance reveal
 * - Bar-chart spectrogram idle-pulse (randomized looping bar height changes in a loop)
 * - Live vocoder synthesis residual indicator
 */
export const AasistTechVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const bars = [25, 60, 45, 80, 95, 70, 40, 85, 90, 65, 30, 75, 55, 90];

  return (
    <motion.div
      className="tech-card-micro-visual"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="tech-micro-spectrogram">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="tech-micro-bar"
            style={{ height: `${h}%` }}
            animate={
              shouldReduceMotion
                ? {}
                : {
                    height: [
                      `${Math.max(15, h * 0.4)}%`,
                      `${Math.min(100, h * 1.15)}%`,
                      `${Math.max(10, h * 0.55)}%`,
                      `${h}%`,
                    ],
                    opacity: [0.75, 1, 0.8, 0.95],
                  }
            }
            transition={{
              repeat: Infinity,
              duration: 1.4 + (i % 4) * 0.2,
              delay: (i % 5) * 0.1,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <div className="tech-micro-footer">
        <span>16kHz Sampling</span>
        <span className="tech-micro-highlight">
          <span className="tech-micro-beacon-dot" /> Zero Vocoder Residual (0.012)
        </span>
      </div>
    </motion.div>
  );
};

/**
 * FIX 3b: Dedicated Micro-Visual for ECAPA-TDNN Tech Card
 * Features:
 * - Scroll-triggered entrance reveal
 * - Dynamic Cosine similarity gauge fill
 * - Live 192-dim vector node points
 */
export const EcapaTechVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="tech-card-micro-visual"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="tech-micro-cosine-track">
        <motion.div
          className="tech-micro-cosine-fill"
          initial={{ width: "0%" }}
          whileInView={{ width: "98.4%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: EDITORIAL_EASE }}
        />
        <motion.div
          className="tech-micro-threshold"
          style={{ left: "85%" }}
          animate={shouldReduceMotion ? {} : { opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        />
      </div>
      <div className="tech-micro-footer">
        <span>
          Cosine Sim: <strong>0.984</strong>
        </span>
        <span className="tech-micro-highlight">192-Dim Acoustic Match</span>
      </div>
    </motion.div>
  );
};

/**
 * FIX 3b: Dedicated Micro-Visual for AudioWorklet DSP Tech Card
 * Features:
 * - Moving/scrolling waveform line (live VU trace)
 * - "VAD Active" pulsing / cross-fading periodically
 * - Scroll-triggered entrance reveal
 */
export const DspTechVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [vadState, setVadState] = useState<"active" | "gate">("active");

  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      setVadState((prev) => (prev === "active" ? "gate" : "active"));
    }, 2400);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <motion.div
      className="tech-card-micro-visual"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="tech-micro-vad-track">
        <svg className="tech-micro-vad-svg" viewBox="0 0 160 28" preserveAspectRatio="none">
          <defs>
            <linearGradient id="vadWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#0a0a0a" stopOpacity="1" />
              <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Animated live VU scrolling waveform */}
          <motion.path
            d="M0,14 Q10,14 20,14 Q26,3 32,25 Q38,5 44,23 Q50,7 56,21 Q62,14 74,14 Q82,2 88,26 Q94,6 100,22 Q106,14 120,14 Q132,4 138,24 Q144,14 160,14"
            fill="none"
            stroke="url(#vadWaveGrad)"
            strokeWidth="1.5"
            animate={
              shouldReduceMotion
                ? {}
                : {
                    d: [
                      "M0,14 Q10,14 20,14 Q26,3 32,25 Q38,5 44,23 Q50,7 56,21 Q62,14 74,14 Q82,2 88,26 Q94,6 100,22 Q106,14 120,14 Q132,4 138,24 Q144,14 160,14",
                      "M0,14 Q10,14 20,14 Q26,6 32,22 Q38,8 44,20 Q50,10 56,18 Q62,14 74,14 Q82,5 88,23 Q94,9 100,19 Q106,14 120,14 Q132,7 138,21 Q144,14 160,14",
                      "M0,14 Q10,14 20,14 Q26,3 32,25 Q38,5 44,23 Q50,7 56,21 Q62,14 74,14 Q82,2 88,26 Q94,6 100,22 Q106,14 120,14 Q132,4 138,24 Q144,14 160,14",
                    ],
                  }
            }
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />

          {/* Sweeping VU needle indicator */}
          {!shouldReduceMotion && (
            <motion.line
              x1="0"
              y1="2"
              x2="0"
              y2="26"
              stroke="#0a0a0a"
              strokeWidth="1"
              strokeDasharray="1 2"
              opacity="0.5"
              animate={{ x: [10, 150, 10] }}
              transition={{ repeat: Infinity, duration: 3.2, ease: "linear" }}
            />
          )}
        </svg>
      </div>
      <div className="tech-micro-footer">
        <span>Rolling 3.0s Buffer</span>
        <motion.span
          className="tech-micro-highlight"
          animate={
            shouldReduceMotion
              ? {}
              : {
                  opacity: [0.8, 1, 0.8],
                  scale: vadState === "active" ? [1, 1.03, 1] : 1,
                }
          }
          transition={{ repeat: Infinity, duration: 1.6 }}
        >
          <span className="tech-vad-beacon-dot" />
          {vadState === "active" ? "VAD Active (Speech)" : "VAD Gate (1.5s Hop)"}
        </motion.span>
      </div>
    </motion.div>
  );
};

/**
 * FIX 3b: Dedicated Micro-Visual for WebRTC SRTP Tech Card
 * Features:
 * - Animated encrypted traveling packet / lock badge along connector line
 * - Pulsing / glowing connector line and lock icon
 * - Scroll-triggered entrance reveal
 */
/**
 * FIX 3b: Dedicated Micro-Visual for WebRTC SRTP Tech Card
 * Features:
 * - Two connection points / beacons traveling toward each other to establish encrypted peer handshake
 * - Pulsing connection line and central handshake lock
 * - Scroll-triggered entrance reveal
 */
export const SrtpTechVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="tech-card-micro-visual"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
    >
      <div className="tech-micro-srtp-track">
        <span className="srtp-node-badge">PEER A</span>
        <div className="srtp-packet-tunnel">
          <svg className="srtp-tunnel-svg" viewBox="0 0 100 12" preserveAspectRatio="none">
            <line
              x1="0"
              y1="6"
              x2="100"
              y2="6"
              stroke="var(--border-strong)"
              strokeWidth="1.2"
              strokeDasharray="2 2"
            />
          </svg>

          {/* Two small connection points traveling toward each other representing real-time connection */}
          {!shouldReduceMotion && (
            <>
              {/* Point A moving from left to center */}
              <motion.div
                className="srtp-traveling-packet"
                animate={{
                  left: ["5%", "48%", "5%"],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.2,
                  ease: "easeInOut",
                }}
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#0a0a0a" }}
              />

              {/* Point B moving from right to center */}
              <motion.div
                className="srtp-traveling-packet"
                animate={{
                  left: ["95%", "52%", "95%"],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.2,
                  ease: "easeInOut",
                }}
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#0a0a0a" }}
              />

              {/* Central Handshake Lock Indicator */}
              <motion.div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "1.5px solid #0a0a0a",
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                animate={{
                  scale: [0.9, 1.15, 0.9],
                  boxShadow: [
                    "0 0 0 0 rgba(0,0,0,0.15)",
                    "0 0 0 4px rgba(0,0,0,0.0)",
                    "0 0 0 0 rgba(0,0,0,0.15)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              >
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0a0a0a" }} />
              </motion.div>
            </>
          )}
        </div>
        <span className="srtp-node-badge">PEER B</span>
      </div>
      <div className="tech-micro-footer">
        <span>DTLS / SRTP Handshake</span>
        <span className="tech-micro-highlight">
          <span className="tech-srtp-beacon-dot" /> Live P2P Connection
        </span>
      </div>
    </motion.div>
  );
};

/**
 * High-Fidelity Continuous Audio Waveform for Hero Live Session Panel
 * Responds organically to DemoState (listening, analyzing, verified)
 */
export const HeroLiveWaveform: React.FC<{ demoState: "listening" | "analyzing" | "verified" }> = ({
  demoState,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // 18 calibrated audio spectral bars simulating natural human speech resonance
  const baseHeights = [
    24, 38, 55, 72, 86, 95, 88, 70, 52, 64, 82, 94, 85, 68, 48, 62, 40, 22,
  ];

  return (
    <div className="hero-preview-waveform-container" style={{ position: "relative", width: "100%" }}>
      {/* Waveform Bars Track */}
      <div className="hero-preview-waveform">
        {baseHeights.map((h, i) => {
          let scaleYAnimation: number[] = [0.3, 0.6, 0.4, 0.7, 0.3];
          let duration = 1.6;

          if (demoState === "listening") {
            // Soft, ambient low energy breathing movement
            scaleYAnimation = [
              0.15 + (i % 3) * 0.05,
              0.35 + (i % 4) * 0.08,
              0.2 + (i % 2) * 0.06,
              0.4 + (i % 3) * 0.05,
              0.15 + (i % 3) * 0.05,
            ];
            duration = 2.0;
          } else if (demoState === "analyzing") {
            // Active speech spectrum dynamics with prominent formant peaks
            const peakFactor = (h / 100);
            scaleYAnimation = [
              Math.max(0.2, peakFactor * 0.4),
              Math.min(1.0, peakFactor * 1.15),
              Math.max(0.25, peakFactor * 0.5),
              Math.min(1.0, peakFactor * 1.05),
              Math.max(0.18, peakFactor * 0.35),
            ];
            duration = 0.85 + (i % 5) * 0.08;
          } else {
            // Verified: settled harmonious harmonic balance
            const stableFactor = (h / 100) * 0.7;
            scaleYAnimation = [
              stableFactor * 0.65,
              stableFactor * 1.0,
              stableFactor * 0.75,
              stableFactor * 0.95,
              stableFactor * 0.65,
            ];
            duration = 1.5;
          }

          return (
            <motion.div
              key={i}
              className="hero-wave-bar"
              style={{ height: "100%" }}
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                      scaleY: scaleYAnimation,
                      opacity: demoState === "analyzing" ? [0.75, 1, 0.8] : [0.7, 0.95, 0.7],
                    }
              }
              transition={{
                repeat: Infinity,
                duration,
                delay: (i % 7) * 0.08,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </div>

      {/* Subtle sweeping scan beam when analyzing */}
      {!shouldReduceMotion && demoState === "analyzing" && (
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "30px",
            background: "linear-gradient(90deg, transparent 0%, rgba(10,10,10,0.18) 50%, transparent 100%)",
            pointerEvents: "none",
          }}
          animate={{
            left: ["-10%", "110%"],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.2,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
};

/**
 * Concentric Sound Wave Ripple Overlay for Ear / Listening Image
 */
export const EarWaveRippleOverlay: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="none">
        {[40, 75, 110, 145].map((r, i) => (
          <motion.circle
            key={i}
            cx="65%"
            cy="48%"
            r={r}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeDasharray={i % 2 === 0 ? "4 3" : undefined}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: [0.8, 1.25],
              opacity: [0, 0.45, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 3.6,
              delay: i * 0.9,
              ease: "easeOut",
            }}
          />
        ))}
      </svg>
    </div>
  );
};

/**
 * Biometric Scanning Grid & Vector Overlay for Fingerprint / Profile Image
 */
export const FingerprintScanOverlay: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      {/* Subtle sweeping horizontal scan line */}
      <motion.div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)",
          boxShadow: "0 0 8px rgba(255,255,255,0.4)",
        }}
        animate={{
          top: ["5%", "92%", "5%"],
        }}
        transition={{
          repeat: Infinity,
          duration: 4.5,
          ease: "easeInOut",
        }}
      />

      {/* Subtle Biometric Target Reticles */}
      <svg width="100%" height="100%" viewBox="0 0 200 200" preserveAspectRatio="none">
        <motion.circle
          cx="48%"
          cy="42%"
          r="22"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.8"
          strokeDasharray="3 2"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
        />
        <circle cx="48%" cy="42%" r="2" fill="#ffffff" opacity="0.8" />
      </svg>
    </div>
  );
};

/**
 * Acoustic Vibration Pulse Overlay for Microphone Hardware Image
 */
export const MicrophonePulseOverlay: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      {/* Subtle audio diaphragm pressure waves */}
      <svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="none">
        {[25, 50, 75].map((r, i) => (
          <motion.circle
            key={i}
            cx="50%"
            cy="46%"
            r={r}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.9"
            animate={{
              r: [r * 0.85, r * 1.15, r * 0.85],
              opacity: [0.1, 0.35, 0.1],
            }}
            transition={{
              repeat: Infinity,
              duration: 2.2,
              delay: i * 0.5,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
    </div>
  );
};

/**
 * Subtle Identity Theft / Threat Signal Scan Overlay for Problem Section
 * Monochrome scanning line and minimal forensic telemetry marker
 */
export const IdentityTheftSignalOverlay: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
      }}
      aria-hidden="true"
    >
      {/* Subtle monochrome scanning beam */}
      {!shouldReduceMotion && (
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "30%",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0) 100%)",
          }}
          initial={{ x: "-120%" }}
          animate={{ x: "320%" }}
          transition={{
            repeat: Infinity,
            duration: 5.5,
            ease: [0.16, 1, 0.3, 1],
            repeatDelay: 2,
          }}
        />
      )}

      {/* Minimal corner coordinates / threat indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 14,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.85)",
          background: "rgba(0,0,0,0.65)",
          padding: "3px 8px",
          borderRadius: 2,
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <motion.span
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#ffffff",
          }}
          animate={shouldReduceMotion ? {} : { opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        />
        <span>THREAT-DETECT // SYNTHESIS VECTOR</span>
      </div>
    </div>
  );
};

/**
 * Living Circuit Board & DSP Hardware Overlay for Solution Section
 * Subtle continuous monochrome scanning beam, hardware coordinate nodes, and active telemetry
 */
export const CircuitBoardScanOverlay: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
      }}
      aria-hidden="true"
    >
      {/* Subtle scanning highlight sweep */}
      {!shouldReduceMotion && (
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "35%",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0) 100%)",
          }}
          initial={{ x: "-120%" }}
          animate={{ x: "320%" }}
          transition={{
            repeat: Infinity,
            duration: 6,
            ease: [0.16, 1, 0.3, 1],
            repeatDelay: 2,
          }}
        />
      )}

      {/* Subtle monochrome hardware node reticles */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {/* Top left reticle */}
        <line x1="14" y1="14" x2="26" y2="14" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <line x1="14" y1="14" x2="14" y2="26" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        {/* Bottom right reticle */}
        <line x1="100%" y1="100%" x2="calc(100% - 12px)" y2="100%" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <line x1="100%" y1="100%" x2="100%" y2="calc(100% - 12px)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      </svg>

      {/* Minimal bottom-left caption tag */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 14,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.85)",
          background: "rgba(0,0,0,0.65)",
          padding: "3px 8px",
          borderRadius: 2,
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <motion.span
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#ffffff",
          }}
          animate={shouldReduceMotion ? {} : { opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        />
        <span>Acoustic DSP // ONNX Execution</span>
      </div>
    </div>
  );
};

export const StepEnrollVisual: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 16, marginTop: 10 }}>
      {[0.4, 0.85, 0.6, 1.0, 0.7].map((h, i) => (
        <motion.span
          key={i}
          style={{
            width: 2,
            height: `${h * 12}px`,
            background: isActive ? "#0a0a0a" : "var(--fg-muted)",
            borderRadius: 1,
            transformOrigin: "center",
          }}
          animate={
            isActive && !shouldReduceMotion
              ? { scaleY: [0.4, 1.2, 0.4] }
              : { scaleY: 1 }
          }
          transition={{
            repeat: Infinity,
            duration: 1.2 + i * 0.15,
            ease: "easeInOut",
            delay: i * 0.1,
          }}
        />
      ))}
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: isActive ? "#0a0a0a" : "var(--fg-muted)", marginLeft: 6, textTransform: "uppercase" }}>
        8s Baseline
      </span>
    </div>
  );
};

export const StepCallVisual: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 16, marginTop: 10, overflow: "hidden" }}>
      <svg width="50" height="12" viewBox="0 0 50 12" fill="none">
        <path
          d="M0 6 Q 6.25 1, 12.5 6 T 25 6 T 37.5 6 T 50 6"
          stroke={isActive ? "#0a0a0a" : "var(--border-strong)"}
          strokeWidth="1.2"
          fill="none"
        />
        {isActive && !shouldReduceMotion && (
          <motion.circle
            r="2"
            fill="#0a0a0a"
            animate={{
              cx: [-5, 55],
              cy: [6, 6],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.8,
              ease: "linear",
            }}
          />
        )}
      </svg>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: isActive ? "#0a0a0a" : "var(--fg-muted)", textTransform: "uppercase" }}>
        SRTP Stream
      </span>
    </div>
  );
};

export const StepAnalyzeVisual: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 16, marginTop: 10, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, height: 12 }}>
        {[0.4, 0.75, 1.0, 0.6, 0.85, 0.5].map((h, i) => (
          <motion.div
            key={i}
            style={{
              width: 2,
              height: `${h * 12}px`,
              background: isActive ? "#0a0a0a" : "var(--fg-muted)",
              borderRadius: 1,
            }}
            animate={
              isActive && !shouldReduceMotion
                ? { opacity: [0.3, 1, 0.3], height: [`${h * 8}px`, `${h * 13}px`, `${h * 8}px`] }
                : {}
            }
            transition={{
              repeat: Infinity,
              duration: 1.4,
              delay: i * 0.12,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: isActive ? "#0a0a0a" : "var(--fg-muted)", textTransform: "uppercase" }}>
        AASIST + ECAPA
      </span>
    </div>
  );
};

export const StepVerifyVisual: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, height: 16, marginTop: 10 }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" stroke={isActive ? "#0a0a0a" : "var(--border-strong)"} strokeWidth="1" />
        <motion.path
          d="M3.5 6 L5.2 7.7 L8.5 4"
          stroke={isActive ? "#0a0a0a" : "var(--fg-muted)"}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: isActive ? 1 : 0.8 }}
          transition={{ duration: 0.3 }}
        />
      </svg>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: isActive ? "#0a0a0a" : "var(--fg-muted)", textTransform: "uppercase" }}>
        Live Integrity State
      </span>
    </div>
  );
};

/**
 * Flowing Telemetry Vector Signal Overlay for Metrics / Solution Photo
 */
export const SignalFlowOverlay: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="none">
        <line x1="0" y1="75" x2="400" y2="75" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
        <motion.circle
          r="3"
          fill="#ffffff"
          opacity="0.75"
          animate={{
            cx: [-20, 420],
            cy: [75, 75],
          }}
          transition={{
            repeat: Infinity,
            duration: 3.2,
            ease: "easeInOut",
          }}
        />
      </svg>
    </div>
  );
};

/**
 * Subtle Monochrome Audio/DSP Signal Scan Overlay for Metrics (LOW LATENCY. HIGH PRECISION.) Image
 */
export const AcousticTelemetryScanOverlay: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      {/* Subtle monochrome audio/DSP measurement scan line */}
      <motion.div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "18%",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 70%, rgba(255,255,255,0.14) 100%)",
          borderRight: "1px solid rgba(255, 255, 255, 0.22)",
        }}
        initial={{ left: "-25%" }}
        animate={{ left: "120%" }}
        transition={{
          repeat: Infinity,
          duration: 6.5,
          ease: [0.16, 1, 0.3, 1],
          repeatDelay: 2.5,
        }}
      />
    </div>
  );
};

/**
 * Animated Peer-to-Peer Encrypted Tunnel Diagram for Security Section
 */
export const SecurityTunnelVisual: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="security-tunnel-card"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: EDITORIAL_EASE }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="security-tunnel-header">
        <span className="security-tunnel-title">DIRECT PEER-TO-PEER ENCRYPTED TUNNEL</span>
        <span className="security-tunnel-badge">AES-256 GCM</span>
      </div>

      <div className="security-tunnel-diagram">
        <div className="security-endpoint endpoint-local">
          <div className="endpoint-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="endpoint-label">Local Peer</span>
          <span className="endpoint-sub">Client DSP &amp; VAD</span>
        </div>

        <div className="security-tunnel-connector">
          <div className="tunnel-rail" />
          <motion.div
            className="tunnel-lock-packet"
            animate={
              shouldReduceMotion
                ? {}
                : {
                    left: ["8%", "88%", "8%"],
                  }
            }
            transition={{
              repeat: Infinity,
              duration: 3.5,
              ease: "easeInOut",
            }}
          >
            <div className="lock-capsule">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>SRTP ENCRYPTED</span>
            </div>
          </motion.div>
        </div>

        <div className="security-endpoint endpoint-remote">
          <div className="endpoint-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="endpoint-label">Remote Peer</span>
          <span className="endpoint-sub">Neural Verification</span>
        </div>
      </div>

      <div className="security-tunnel-footer">
        <div className="security-guarantee-point">
          <span className="guarantee-dot" />
          <span>Zero Media Stored on Signaling Server</span>
        </div>
        <div className="security-guarantee-point">
          <span className="guarantee-dot" />
          <span>Strict In-Memory Analysis</span>
        </div>
        <div className="security-guarantee-point">
          <span className="guarantee-dot" />
          <span>Automatic Session Cleardown</span>
        </div>
      </div>
    </motion.div>
  );
};
