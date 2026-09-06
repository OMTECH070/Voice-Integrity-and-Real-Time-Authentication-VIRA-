import { useState, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import Lenis from "lenis";
import { Marquee } from "../components/landing/Marquee";
import { MagneticButton } from "../components/landing/MagneticButton";
import { StaggeredHeadline } from "../components/landing/StaggeredHeadline";
import { AcousticWaveMesh } from "../components/landing/AcousticWaveMesh";
import {
  VectorMatrixVisual,
  SpectrogramVisual,
  CosineMatchVisual,
  RollingBufferVisual,
  EncryptedMeshVisual,
  VadGateVisual,
  AasistTechVisual,
  EcapaTechVisual,
  DspTechVisual,
  SrtpTechVisual,
  SecurityTunnelVisual,
  HeroLiveWaveform,
  MicrophonePulseOverlay,
  IdentityTheftSignalOverlay,
  CircuitBoardScanOverlay,
  AcousticTelemetryScanOverlay,
  StepEnrollVisual,
  StepCallVisual,
  StepAnalyzeVisual,
  StepVerifyVisual,
} from "../components/landing/FeatureVisuals";
import { HeroVerificationAnimation } from "../components/landing/HeroVerificationAnimation";
import {
  fadeUpVariant,
  fadeInVariant,
  staggerContainerVariant,
  cardOddVariant,
  cardEvenVariant,
  EDITORIAL_EASE,
} from "../lib/motion";

// Unique section images (12 distinct scenes)
import problemImg from "../assets/landing/problem-identity-theft.jpg";
import solutionPipelineImg from "../assets/landing/solution-pipeline-inspect.jpg";
import acousticHardwareImg from "../assets/landing/acoustic-hardware-interface.jpg";
import metricsTelemetryImg from "../assets/landing/metrics-telemetry-benchmarks.jpg";
import coreCapabilitiesProfileImg from "../assets/landing/core-capabilities-profile.png";
import howEnrollmentImg from "../assets/landing/how-enrollment-voice.jpg";
import techAasistSpectrogramImg from "../assets/landing/tech-aasist-spectrogram.jpg";
import techEcapaEmbeddingsImg from "../assets/landing/tech-ecapa-embeddings.jpg";
import howCompareImg from "../assets/landing/how-verification-compare.jpg";
import pipelineResultDashboardImg from "../assets/landing/pipeline-result-dashboard.jpg";
import distributedBannerImg from "../assets/landing/distributed-network-banner.jpg";
import securityTunnelImg from "../assets/landing/security-encrypted-tunnel.jpg";
import talkConfidenceImg from "../assets/landing/talk-confidence.jpg";
import finalCtaAtmosphereImg from "../assets/landing/final-cta-atmosphere.jpg";
import { useEasyMode } from "../context/EasyModeContext";
import { EasyModeLanding } from "../components/EasyModeLanding";
import { EasyModeNavToggle } from "../components/EasyModeNavToggle";

function LiveSignalStatusPanel({ shouldReduceMotion }: { shouldReduceMotion?: boolean | null }) {
  const [verificationRate, setVerificationRate] = useState(98.7);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const rates = [98.7, 98.6, 98.8, 98.7, 98.9, 98.5, 98.8, 98.7];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % rates.length;
      setVerificationRate(rates[idx]);
    }, 2800);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <div className="live-signal-telemetry-panel" aria-label="Live signal status telemetry">
      <div className="telemetry-header">
        <span className="telemetry-header-title">LIVE SIGNAL STATUS</span>
        <div className="telemetry-header-wave" aria-hidden="true">
          <svg className="telemetry-wave-svg" viewBox="0 0 120 14" fill="none">
            <path
              d="M0 7 Q 15 1, 30 7 T 60 7 T 90 7 T 120 7 Q 135 1, 150 7 T 180 7 T 210 7 T 240 7"
              stroke="var(--color-black)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <div className="telemetry-rows">
        <div className="telemetry-row">
          <div className="telemetry-row-label">
            <span className="telemetry-pulse-dot" aria-hidden="true" />
            <span>SIGNAL INPUT</span>
          </div>
          <span className="telemetry-row-val mono">16 kHz</span>
        </div>

        <div className="telemetry-divider" />

        <div className="telemetry-row">
          <span className="telemetry-row-label">SPEAKER PROFILE</span>
          <span className="telemetry-row-val status-badge">MATCHED</span>
        </div>

        <div className="telemetry-divider" />

        <div className="telemetry-row">
          <span className="telemetry-row-label">ANTI-SPOOF</span>
          <span className="telemetry-row-val status-badge">CLEAN</span>
        </div>

        <div className="telemetry-divider" />

        <div className="telemetry-row">
          <span className="telemetry-row-label">VERIFICATION</span>
          <span className="telemetry-row-val mono" style={{ fontVariantNumeric: "tabular-nums" }}>
            {verificationRate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

interface LandingPageProps {
  onLaunchApp?: () => void;
  onLogin?: () => void;
  onSignUp?: () => void;
  isAuthenticated: boolean;
}

type DemoState = "listening" | "analyzing" | "verified";

export function LandingPage({
  onLaunchApp,
  onLogin,
  onSignUp,
  isAuthenticated: _isAuthenticated,
}: LandingPageProps) {
  const { isEasyMode } = useEasyMode();

  if (isEasyMode) {
    return (
      <EasyModeLanding
        onLogin={onLogin}
        onSignUp={onSignUp}
        onLaunchApp={onLaunchApp}
        isAuthenticated={_isAuthenticated}
      />
    );
  }

  const shouldReduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);
  const techRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const capabilitiesRef = useRef<HTMLDivElement>(null);
  const fullBleedRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // 0a — Smooth momentum scrolling via Lenis
  useEffect(() => {
    if (shouldReduceMotion) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.8,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [shouldReduceMotion]);

  // Navbar hairline border & soft shadow on scroll
  const { scrollY } = useScroll();
  const navBorderColor = useTransform(
    scrollY,
    [0, 30],
    ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.12)"]
  );
  const navShadow = useTransform(
    scrollY,
    [0, 30],
    ["0 0 0 rgba(0, 0, 0, 0)", "0 2px 12px rgba(0, 0, 0, 0.05)"]
  );

  // Scroll-linked Parallax for Problem Photo (~60% scroll speed)
  const { scrollYProgress: problemScrollProgress } = useScroll({
    target: problemRef,
    offset: ["start end", "end start"],
  });
  const problemImgY = useTransform(problemScrollProgress, [0, 1], ["-8%", "8%"]);
  const problemScrollScale = useTransform(problemScrollProgress, [0.15, 0.85], [0, 1]);

  // Scroll-linked Parallax for Solution Photo
  const { scrollYProgress: solutionScrollProgress } = useScroll({
    target: solutionRef,
    offset: ["start end", "end start"],
  });
  const solutionImgY = useTransform(solutionScrollProgress, [0, 1], ["-6%", "6%"]);

  // Scroll-linked Parallax for Technology Photo
  const { scrollYProgress: techScrollProgress } = useScroll({
    target: techRef,
    offset: ["start end", "end start"],
  });
  const techImgY = useTransform(techScrollProgress, [0, 1], ["-6%", "6%"]);



  const { scrollYProgress: fullBleedScrollProgress } = useScroll({
    target: fullBleedRef,
    offset: ["start end", "end start"],
  });
  const fullBleedImgY = useTransform(fullBleedScrollProgress, [0, 1], ["-10%", "10%"]);

  // Scroll-linked Parallax for Final CTA Photo
  const { scrollYProgress: ctaScrollProgress } = useScroll({
    target: ctaRef,
    offset: ["start end", "end start"],
  });
  const ctaImgY = useTransform(ctaScrollProgress, [0, 1], ["-8%", "8%"]);

  // Interactive UI states
  const [demoState, setDemoState] = useState<DemoState>("verified");
  const [activeProcessStep, setActiveProcessStep] = useState<number>(0);
  const [activeTimelineStep, setActiveTimelineStep] = useState<number>(2);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Animated word-cycle element above hero headline
  const cyclingWords = ["CALLS.", "TEAMS.", "SUPPORT LINES.", "FINANCE.", "EVERYONE."];
  const [cyclingIndex, setCyclingIndex] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      setCyclingIndex((prev) => (prev + 1) % cyclingWords.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  // Auto-cycle the hero UI demo state subtly every 5 seconds unless manually toggled
  useEffect(() => {
    const states: DemoState[] = ["listening", "analyzing", "verified"];
    const timer = setInterval(() => {
      setDemoState((prev) => {
        const nextIdx = (states.indexOf(prev) + 1) % states.length;
        return states[nextIdx];
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const processSteps = [
    {
      num: "01",
      title: "ENROLL",
      subtitle: "One-time 8-second passphrase",
      desc: "Record a short voice sample. VIRA extracts a private 192-dimensional numerical embedding that acts as your irreversible acoustic baseline.",
    },
    {
      num: "02",
      title: "CALL",
      subtitle: "Encrypted WebRTC media stream",
      desc: "Connect directly to your contact over end-to-end encrypted WebRTC audio. Speech activity is detected locally in real time.",
    },
    {
      num: "03",
      title: "ANALYZE",
      subtitle: "Rolling 3.0-second speech buffer",
      desc: "Speech chunks are continuously evaluated by AASIST for vocoder/synthesis artifacts and by ECAPA-TDNN for speaker identity features.",
    },
    {
      num: "04",
      title: "VERIFY",
      subtitle: "Continuous live integrity state",
      desc: "Multi-signal temporal smoothing confirms voice authenticity and alerts you immediately if a cloned or mismatched voice is detected.",
    },
  ];

  const features = [
    {
      num: "01",
      title: "VOICE ID",
      summary: "Create an enrolled voice profile for speaker verification.",
      details: "A one-time 8-second recording generates an irreversible 192-dimensional acoustic embedding. Your raw audio is processed strictly in memory and never saved to disk.",
      visual: <VectorMatrixVisual />,
    },
    {
      num: "02",
      title: "ANTI-SPOOF DETECTION",
      summary: "Detect signals associated with synthetic or manipulated speech.",
      details: "The AASIST ONNX neural model continuously inspects 16kHz spectral characteristics to detect vocoder artifacts, deepfake synthesis, and audio replay.",
      visual: <SpectrogramVisual />,
    },
    {
      num: "03",
      title: "SPEAKER IDENTIFICATION",
      summary: "Compare incoming voice with the enrolled identity.",
      details: "ECAPA-TDNN extracts live acoustic vectors and computes cosine similarity against the verified contact baseline to ensure the caller matches their identity.",
      visual: <CosineMatchVisual />,
    },
    {
      num: "04",
      title: "REAL-TIME VERIFICATION",
      summary: "Inspect audio during active WebRTC conversations.",
      details: "A non-intrusive client-side background worker buffers speech and performs dual-model inference every 1.5s with zero impact on call quality.",
      visual: <RollingBufferVisual />,
    },
    {
      num: "05",
      title: "WEBRTC COMMUNICATION",
      summary: "End-to-end encrypted peer-to-peer audio calls.",
      details: "Audio is transmitted directly between peers using DTLS-SRTP encryption. Signaling servers coordinate connections but never intercept media.",
      visual: <EncryptedMeshVisual />,
    },
    {
      num: "06",
      title: "VOICE ACTIVITY DETECTION",
      summary: "Client-side DSP isolates speech from ambient noise.",
      details: "An AudioWorklet processor evaluates energy thresholds and zero-crossing rates in real time so neural models only analyze voiced segments.",
      visual: <VadGateVisual />,
    },
  ];

  const timelineSteps = [
    {
      num: "01",
      title: "Voice Capture",
      desc: "AudioWorklet DSP isolates speech segments at 16kHz with real-time VAD gating.",
      image: howEnrollmentImg,
      alt: "Voice capture acoustic recording through studio microphone",
    },
    {
      num: "02",
      title: "Feature Extraction",
      desc: "Client-side buffer window segments speech into rolling 3.0s analysis chunks.",
      image: techAasistSpectrogramImg,
      alt: "Feature extraction spectrogram and frequency analysis",
    },
    {
      num: "03",
      title: "Neural Inference",
      desc: "Speech vectors are analyzed through local ONNX Runtime inference pipelines.",
      image: techEcapaEmbeddingsImg,
      alt: "Neural inference computational embedding vectors",
    },
    {
      num: "04",
      title: "Identity Check",
      desc: "AASIST scans for synthetic vocoder artifacts while ECAPA-TDNN matches speaker characteristics.",
      image: howCompareImg,
      alt: "Identity check acoustic comparison screen",
    },
    {
      num: "05",
      title: "Result",
      desc: "Continuous fused integrity feedback is displayed live on the call interface in real time.",
      image: pipelineResultDashboardImg,
      alt: "Verification result and continuous monitoring dashboard",
    },
  ];

  const faqs = [
    {
      q: "What is VIRA?",
      a: "VIRA (Voice Integrity & Real-Time Authentication) is a secure voice communication application that authenticates caller identity and detects synthetic AI voices during live calls.",
    },
    {
      q: "How does voice verification work?",
      a: "During an active call, client-side VAD captures clean speech segments into a rolling 3.0-second buffer. VIRA evaluates these frames using two specialized neural models: AASIST for synthetic speech detection and ECAPA-TDNN for speaker identity verification.",
    },
    {
      q: "Can VIRA detect synthetic voices?",
      a: "Yes. The AASIST anti-spoof model analyzes spectral acoustics and vocoder artifacts in 16kHz audio to flag AI voice clones, text-to-speech generators, and manipulated audio.",
    },
    {
      q: "How does speaker identification work?",
      a: "ECAPA-TDNN computes a 192-dimensional embedding from incoming speech and measures cosine similarity against the enrolled contact's baseline vector. A similarity above threshold confirms the enrolled identity.",
    },
    {
      q: "Do I need to enroll my voice?",
      a: "Enrollment takes 8 seconds and is recommended so contacts can verify your identity. You can still initiate and receive calls without enrolling, but your identity will appear as unenrolled to other callers.",
    },
    {
      q: "How does VIRA use WebRTC?",
      a: "WebRTC establishes encrypted, direct peer-to-peer audio connections between browsers. Call audio plays uninterrupted through standard HTML5 media while a parallel non-intrusive stream performs acoustic analysis.",
    },
    {
      q: "Is my voice information stored?",
      a: "No raw voice recordings or call audio are ever stored on disk or servers. Enrollment creates an irreversible 192-dimensional numerical vector stored under your private account via Supabase Row-Level Security.",
    },
  ];

  return (
    <div className="landing-page-container">
      {/* 01 — NAVBAR (Sticky solid white with scroll-triggered hairline border & soft shadow) */}
      <motion.header
        className="landing-navbar"
        role="banner"
        style={{
          backgroundColor: "#ffffff",
          borderBottomColor: navBorderColor,
          boxShadow: navShadow,
        }}
      >
        <div className="landing-nav-inner">
          <motion.div
            className="landing-brand-col"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{ cursor: "pointer" }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="landing-brand-logo">VIRA</span>
          </motion.div>

          <nav className="landing-nav-links" aria-label="Landing Navigation">
            {["technology", "product", "how-it-works", "security", "faq"].map((sec) => {
              const labelMap: Record<string, string> = {
                technology: "Technology",
                product: "Product",
                "how-it-works": "How it works",
                security: "Security",
                faq: "FAQ",
              };
              return (
                <button
                  key={sec}
                  className="landing-nav-link"
                  onClick={() => scrollToSection(sec)}
                >
                  <span>{labelMap[sec]}</span>
                  <span className="nav-link-underline" />
                </button>
              );
            })}
          </nav>

          <div className="landing-nav-actions">
            <EasyModeNavToggle />
            <button className="landing-btn-text" onClick={onLogin || onLaunchApp}>
              Sign In
            </button>
            <MagneticButton
              className="landing-btn-launch"
              onClick={onSignUp || onLaunchApp}
            >
              Sign Up
            </MagneticButton>
          </div>
        </div>
      </motion.header>

      <main>
        {/* 02 — HERO SECTION */}
        <section className="landing-hero-section" ref={heroRef}>
          <AcousticWaveMesh className="landing-hero-mesh" />

          <div className="landing-hero-inner">
            <div className="landing-hero-content">
              {/* Part 1c — Eyebrow Word-Cycle Element */}
              <div className="hero-eyebrow-row">
                <span className="hero-eyebrow-prefix">VOICE INTEGRITY VERIFICATION FOR</span>
                <span className="hero-word-pill-wrap">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={cyclingWords[cyclingIndex]}
                      className="hero-word-pill"
                      initial={shouldReduceMotion ? false : { y: 16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={shouldReduceMotion ? undefined : { y: -16, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EDITORIAL_EASE }}
                    >
                      {cyclingWords[cyclingIndex]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>

              {/* Line-by-Line Decoding Mask Headline */}
              <StaggeredHeadline
                as="h1"
                className="landing-hero-headline"
                text={"KNOW WHO YOU’RE\nREALLY TALKING TO."}
                delay={0.2}
              />

              <motion.p
                className="landing-hero-subheading"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5, ease: EDITORIAL_EASE }}
              >
                Real-time voice integrity verification for secure voice communication.
              </motion.p>

              <motion.div
                className="landing-hero-actions"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5, ease: EDITORIAL_EASE }}
              >
                <MagneticButton className="btn-primary" href="/start" onClick={onLaunchApp}>
                  Start with VIRA
                </MagneticButton>
                <a
                  className="landing-hero-secondary-link"
                  href="/how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection("how-it-works");
                  }}
                >
                  See how it works <span className="arrow">→</span>
                </a>
              </motion.div>
            </div>

            <motion.div
              className="landing-hero-widget"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6, ease: EDITORIAL_EASE }}
            >
              {/* Voice Integrity live preview card component */}
              <div className="hero-preview-card">
                <div className="hero-card-header-block">
                  <span className="hero-preview-label">VOICE INTEGRITY</span>
                  <div className="hero-preview-session-desc">Live voice session</div>
                  <div className="hero-preview-state-pill">
                    <AnimatePresence mode="wait">
                      {demoState === "listening" && (
                        <motion.span
                          key="listening"
                          className="state-tag listening"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.2 }}
                        >
                          <motion.span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#ffffff",
                              marginRight: 6,
                            }}
                            animate={shouldReduceMotion ? {} : { scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] }}
                            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                          />
                          Listening
                        </motion.span>
                      )}
                      {demoState === "analyzing" && (
                        <motion.span
                          key="analyzing"
                          className="state-tag analyzing"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.2 }}
                        >
                          <motion.span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#0a0a0a",
                              marginRight: 6,
                            }}
                            animate={shouldReduceMotion ? {} : { opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                          />
                          Analyzing...
                        </motion.span>
                      )}
                      {demoState === "verified" && (
                        <motion.span
                          key="verified"
                          className="state-tag verified"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.2 }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            style={{ display: "inline-block", marginRight: 5 }}
                          >
                            <motion.path
                              d="M2 6.5 L4.8 9.3 L10 3"
                              stroke="#ffffff"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.35, ease: "easeOut" }}
                            />
                          </svg>
                          Voice Verified
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* High-Fidelity Continuous Audio Waveform */}
                <HeroLiveWaveform demoState={demoState} />

                {/* Metrics with Non-Invented Descriptive States */}
                <div className="hero-preview-metrics">
                  <div className="hero-metric-item">
                    <span className="hero-metric-label">AASIST Anti-Spoof</span>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`aasist-${demoState}`}
                        className="hero-metric-val"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {demoState === "listening"
                          ? "Listening for speech"
                          : demoState === "analyzing"
                          ? "Evaluating spectrogram"
                          : "Human Voice Confirmed"}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <div className="hero-metric-item">
                    <span className="hero-metric-label">ECAPA Speaker Match</span>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`ecapa-${demoState}`}
                        className="hero-metric-val"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {demoState === "listening"
                          ? "Waiting for speech"
                          : demoState === "analyzing"
                          ? "Comparing embeddings"
                          : "Match Confirmed"}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>

                {/* State Toggle Buttons */}
                <div className="hero-preview-state-controls">
                  <span className="hero-preview-control-title">Live Preview State</span>
                  <div className="hero-preview-btn-group">
                    {(["listening", "analyzing", "verified"] as DemoState[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`hero-state-btn ${demoState === st ? "active" : ""}`}
                        onClick={() => setDemoState(st)}
                      >
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 03 — MARQUEE STRIP (Repeated phrase strip with edge fade-mask) */}
        <section className="marquee-section" aria-label="Core Principles Marquee">
          <Marquee speed={24}>
            <div className="marquee-words-row">
              <span>REAL-TIME</span>
              <span className="marquee-sep">⊙</span>
              <span>VERIFIED</span>
              <span className="marquee-sep">⊙</span>
              <span>IN-MEMORY DSP</span>
              <span className="marquee-sep">⊙</span>
              <span>ENCRYPTED</span>
              <span className="marquee-sep">⊙</span>
              <span>NEURAL ACOUSTIC</span>
              <span className="marquee-sep">⊙</span>
              <span>ANTI-SPOOF</span>
              <span className="marquee-sep">⊙</span>
              <span>ZERO-RETENTION</span>
              <span className="marquee-sep">⊙</span>
            </div>
          </Marquee>
        </section>

        {/* 04 — PROBLEM SECTION (Voice Fraud Is Real + Identity Theft Evidence) */}
        <section ref={problemRef} className="landing-problem-section">
          <div className="landing-container">
            <div className="landing-problem-grid">
              <div className="problem-text-column">
                <h2 className="landing-problem-title">
                  {["VOICE FRAUD IS", "REAL.", "AND GROWING."].map((line, i) => (
                    <div key={i} className="problem-headline-line-mask">
                      <motion.span
                        style={{ display: "block" }}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 25 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: "some" }}
                        transition={{
                          duration: 0.8,
                          delay: 0.12 * i,
                          ease: EDITORIAL_EASE,
                        }}
                      >
                        {line}
                      </motion.span>
                    </div>
                  ))}
                </h2>

                <div className="landing-problem-points">
                  {[
                    "AI voice cloning tools can replicate any voice from just a few seconds of audio.",
                    "During a voice call, traditional communication tools provide little evidence about whether the speaker is authentic.",
                    "Anyone can sound like your colleague, executive, family member, or trusted partner.",
                  ].map((pointText, i) => (
                    <div key={i} className="problem-point">
                      <motion.span
                        className="problem-dash"
                        initial={shouldReduceMotion ? false : { scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true, amount: "some" }}
                        transition={{
                          duration: 0.4,
                          delay: 0.25 + 0.12 * i,
                          ease: EDITORIAL_EASE,
                        }}
                      >
                        —
                      </motion.span>
                      <motion.p
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: "some" }}
                        transition={{
                          duration: 0.6,
                          delay: 0.25 + 0.12 * i,
                          ease: EDITORIAL_EASE,
                        }}
                      >
                        {pointText}
                      </motion.p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Black & White Identity-Theft Image with Smooth Fade & TranslateY Entrance */}
              <motion.div
                className="problem-image-wrapper"
                aria-hidden="true"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: "some" }}
                transition={{ duration: 0.9, ease: EDITORIAL_EASE }}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.3, ease: EDITORIAL_EASE },
                }}
              >
                <motion.img
                  src={problemImg}
                  alt="Identity security tactile imagery"
                  className="problem-photo"
                  style={{ y: problemImgY }}
                  animate={shouldReduceMotion ? {} : { scale: [1, 1.015, 1] }}
                  transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
                />
                <IdentityTheftSignalOverlay />
              </motion.div>
            </div>
          </div>

          {/* Section Bottom Scroll Progress Track */}
          <div className="problem-progress-track" aria-hidden="true">
            <div className="problem-progress-base" />
            <motion.div
              className="problem-progress-fill"
              style={{ scaleX: problemScrollScale }}
            />
          </div>
        </section>

        {/* 06 — TECHNOLOGY SECTION */}
        <section id="technology" ref={techRef} className="landing-tech-section">
          <div className="landing-container">
            <div className="tech-section-header-grid">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={fadeUpVariant}
              >
                <StaggeredHeadline
                  text={"BUILT ON DEDICATED\nNEURAL ACOUSTIC MODELS"}
                  as="h2"
                  className="landing-tech-main-title"
                />
                <p className="landing-tech-lead">
                  Dual deep-learning architectures running on ONNX Runtime inspect speech characteristics simultaneously.
                </p>
              </motion.div>

              <motion.div
                className="tech-hero-photo-wrapper"
                aria-hidden="true"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeInVariant}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3, ease: EDITORIAL_EASE }}
              >
                <motion.img
                  src={acousticHardwareImg}
                  alt="Acoustic hardware and spectral audio interface"
                  className="tech-microphone-photo"
                  style={{ y: techImgY }}
                  animate={
                    shouldReduceMotion
                      ? {}
                      : {
                          scale: [1, 1.018, 1],
                        }
                  }
                  transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                />
                <MicrophonePulseOverlay />
              </motion.div>
            </div>

            {/* 4 Technology Cards with Dedicated Live Micro-Visuals */}
            <motion.div
              className="landing-tech-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainerVariant}
            >
              {/* Card 1: AASIST (Odd -> cardOddVariant) */}
              <motion.div
                className="landing-tech-item"
                variants={cardOddVariant}
                whileHover={{ y: -4 }}
              >
                <div className="tech-item-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </div>
                <h3 className="tech-name">AASIST</h3>
                <div className="tech-role">Anti-Spoofing Neural Model</div>
                <p className="tech-desc">
                  Inspects 16kHz audio spectral patterns to detect synthetic vocoders, TTS generators, and voice conversion artifacts.
                </p>
                <motion.div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    width: "100%",
                    margin: "12px 0",
                    transformOrigin: "left",
                  }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.15, ease: EDITORIAL_EASE }}
                />
                <AasistTechVisual />
              </motion.div>

              {/* Card 2: ECAPA-TDNN (Even -> cardEvenVariant) */}
              <motion.div
                className="landing-tech-item"
                variants={cardEvenVariant}
                whileHover={{ y: -4 }}
              >
                <div className="tech-item-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className="tech-name">ECAPA-TDNN</h3>
                <div className="tech-role">Speaker Verification Model</div>
                <p className="tech-desc">
                  Extracts 192-dimensional acoustic embeddings and measures cosine similarity against enrolled contact baselines.
                </p>
                <motion.div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    width: "100%",
                    margin: "12px 0",
                    transformOrigin: "left",
                  }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.2, ease: EDITORIAL_EASE }}
                />
                <EcapaTechVisual />
              </motion.div>

              {/* Card 3: AudioWorklet DSP (Odd -> cardOddVariant) */}
              <motion.div
                className="landing-tech-item"
                variants={cardOddVariant}
                whileHover={{ y: -4 }}
              >
                <div className="tech-item-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <h3 className="tech-name">AudioWorklet DSP</h3>
                <div className="tech-role">Voice Activity Detection</div>
                <p className="tech-desc">
                  Client-side DSP isolates active speech into rolling 3.0-second buffers, filtering background noise and pauses.
                </p>
                <motion.div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    width: "100%",
                    margin: "12px 0",
                    transformOrigin: "left",
                  }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.25, ease: EDITORIAL_EASE }}
                />
                <DspTechVisual />
              </motion.div>

              {/* Card 4: WebRTC SRTP (Even -> cardEvenVariant) */}
              <motion.div
                className="landing-tech-item"
                variants={cardEvenVariant}
                whileHover={{ y: -4 }}
              >
                <div className="tech-item-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3 className="tech-name">WebRTC SRTP</h3>
                <div className="tech-role">Peer-to-Peer Encryption</div>
                <p className="tech-desc">
                  Direct browser-to-browser encrypted transport. Raw voice data is analyzed strictly in volatile memory.
                </p>
                <motion.div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    width: "100%",
                    margin: "12px 0",
                    transformOrigin: "left",
                  }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.3, ease: EDITORIAL_EASE }}
                />
                <SrtpTechVisual />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* 06b — PERFORMANCE TELEMETRY SECTION (LOW LATENCY. HIGH PRECISION.) */}
        <section ref={metricsRef} className="landing-metrics-section" aria-label="Performance Telemetry">
          <div className="landing-container">
            <div className="metrics-main-content">
              {/* Left Column: Heading + Description */}
              <div className="metrics-text-col">
                <h2 className="metrics-main-title">
                  {["LOW LATENCY.", "HIGH PRECISION."].map((line, i) => (
                    <div key={i} className="metrics-headline-line-mask">
                      <motion.span
                        style={{ display: "block" }}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: "some" }}
                        transition={{
                          duration: 0.8,
                          delay: 0.12 * i,
                          ease: EDITORIAL_EASE,
                        }}
                      >
                        {line}
                      </motion.span>
                    </div>
                  ))}
                </h2>
                <motion.p
                  className="metrics-lead"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: "some" }}
                  transition={{
                    duration: 0.6,
                    delay: 0.28,
                    ease: EDITORIAL_EASE,
                  }}
                >
                  Designed for active voice channels with sub-15 millisecond execution time and continuous multi-signal fusion.
                </motion.p>
              </div>

              {/* Right Column: Compact B&W DSP/Audio Image with Telemetry Scan Overlay */}
              <motion.div
                className="metrics-photo-wrapper"
                aria-hidden="true"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: "some" }}
                transition={{ duration: 0.8, ease: EDITORIAL_EASE }}
                whileHover={{
                  scale: 1.01,
                  transition: { duration: 0.4, ease: EDITORIAL_EASE },
                }}
              >
                <img
                  src={metricsTelemetryImg}
                  alt="Real-time acoustic telemetry and latency metrics"
                  className="metrics-photo"
                />
                <AcousticTelemetryScanOverlay />
                <div className="metrics-photo-badge">
                  <span className="metrics-badge-dot" />
                  <span>REAL-TIME IN-MEMORY DSP • ONNX PIPELINE</span>
                </div>
              </motion.div>
            </div>

            {/* 4 Stat Cards in a responsive grid */}
            <div className="metrics-stats-grid">
              {[
                {
                  number: "<15ms",
                  label: "Inference Latency",
                  desc: "Zero perceptible lag during active WebRTC conversations.",
                },
                {
                  number: "98.4%",
                  label: "Speaker Match Accuracy",
                  desc: "Cosine similarity across 192-dimensional embedding space.",
                },
                {
                  number: "16kHz",
                  label: "Spectral Sampling",
                  desc: "High-frequency vocoder and anti-spoof acoustic analysis.",
                },
                {
                  number: "0.0 MB",
                  label: "Audio Disk Retention",
                  desc: "Volatile memory processing with instant teardown on hangup.",
                },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="metrics-stat-item"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: "some" }}
                  transition={{
                    duration: 0.65,
                    delay: 0.15 + 0.12 * i,
                    ease: EDITORIAL_EASE,
                  }}
                  whileHover={{
                    y: -3,
                    transition: { duration: 0.2, ease: EDITORIAL_EASE },
                  }}
                >
                  <div className="stat-number">{stat.number}</div>
                  <div className="stat-label">{stat.label}</div>
                  <p className="stat-desc">{stat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 07 — TECH STACK MARQUEE */}
        <section className="marquee-section tech-badges-marquee" aria-label="Technology Stack Badges">
          <Marquee speed={28} reverse>
            <div className="marquee-badges-row">
              <span className="marquee-badge-item">AASIST SPECTRAL ANALYSIS</span>
              <span className="marquee-dot">•</span>
              <span className="marquee-badge-item">ECAPA-TDNN 192-DIM</span>
              <span className="marquee-dot">•</span>
              <span className="marquee-badge-item">WEBRTC DTLS / SRTP</span>
              <span className="marquee-dot">•</span>
              <span className="marquee-badge-item">ONNX RUNTIME</span>
              <span className="marquee-dot">•</span>
              <span className="marquee-badge-item">SUPABASE ROW-LEVEL SECURITY</span>
              <span className="marquee-dot">•</span>
              <span className="marquee-badge-item">CLIENT-SIDE AUDIOWORKLET VAD</span>
              <span className="marquee-dot">•</span>
              <span className="marquee-badge-item">ZERO AUDIO RETENTION ON DISK</span>
              <span className="marquee-dot">•</span>
            </div>
          </Marquee>
        </section>

        {/* 05 — SOLUTION SECTION (Continuous Voice Integrity + 4-Step Pipeline) */}
        <section id="product" ref={solutionRef} className="landing-solution-section">
          <div className="landing-container">
            {/* Header: Left Text Column + Right Circuit-Board Image */}
            <div className="solution-header-grid">
              <div className="solution-headline-block">
                <h2 className="landing-solution-title">
                  {["CONTINUOUS VOICE", "INTEGRITY", "FOR ACTIVE", "CONVERSATIONS"].map((line, i) => (
                    <div key={i} className="solution-headline-line-mask" style={{ overflow: "hidden", display: "block" }}>
                      <motion.span
                        style={{ display: "block" }}
                        initial={{ opacity: 0, y: 35 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{
                          duration: 0.8,
                          delay: 0.12 * i,
                          ease: EDITORIAL_EASE,
                        }}
                      >
                        {line}
                      </motion.span>
                    </div>
                  ))}
                </h2>
                <motion.p
                  className="landing-solution-subtitle"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.55,
                    ease: EDITORIAL_EASE,
                  }}
                >
                  VIRA continuously evaluates incoming speech in real time, detecting AI clones and confirming caller identity.
                </motion.p>
              </div>

              {/* Right: Circuit Board Image with Entrance, Scale Oscillation, Parallax & Overlay */}
              <motion.div
                className="solution-photo-wrapper"
                aria-hidden="true"
                initial={{ opacity: 0, x: 50, scale: 0.96 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 1.1, ease: EDITORIAL_EASE }}
                whileHover={{ scale: 1.015 }}
              >
                <motion.img
                  src={solutionPipelineImg}
                  alt="Acoustic DSP circuit architecture"
                  className="solution-photo"
                  style={{ y: solutionImgY }}
                  animate={shouldReduceMotion ? {} : { scale: [1, 1.025, 1] }}
                  transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
                />
                <CircuitBoardScanOverlay />
              </motion.div>
            </div>

            {/* Connecting Track between Steps */}
            <div className="pipeline-connection-wrapper" aria-hidden="true">
              <div className="pipeline-connection-rail">
                <div className="pipeline-connection-base" />
                <motion.div
                  className="pipeline-connection-fill"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 1.2, delay: 0.2, ease: EDITORIAL_EASE }}
                />
              </div>
            </div>

            {/* Interactive 4-Step Pipeline */}
            <div className="solution-pipeline-grid">
              {processSteps.map((step, idx) => {
                const isActive = activeProcessStep === idx;
                const cardDelay = 0.15 * (idx + 1);

                return (
                  <motion.div
                    key={step.num}
                    className={`solution-pipeline-step ${isActive ? "active" : ""}`}
                    onClick={() => setActiveProcessStep(idx)}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.65, delay: cardDelay, ease: EDITORIAL_EASE }}
                    whileHover={{
                      y: -5,
                      transition: { duration: 0.2, ease: EDITORIAL_EASE },
                    }}
                  >
                    <div className="pipeline-step-header">
                      <motion.span
                        className="pipeline-num"
                        whileHover={{ scale: 1.08 }}
                        transition={{ duration: 0.15 }}
                      >
                        {step.num}
                      </motion.span>
                      <h3 className="pipeline-title">{step.title}</h3>
                      <div className="pipeline-indicator-slot">
                        {isActive && (
                          <motion.span
                            layoutId="activePipelineDot"
                            className="pipeline-active-indicator"
                            animate={
                              shouldReduceMotion
                                ? {}
                                : { scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }
                            }
                            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="pipeline-subtitle">{step.subtitle}</div>
                    <p className="pipeline-desc">{step.desc}</p>

                    {/* Step-specific micro-visualizers */}
                    <div className="pipeline-step-visual-slot">
                      {idx === 0 && <StepEnrollVisual isActive={isActive} />}
                      {idx === 1 && <StepCallVisual isActive={isActive} />}
                      {idx === 2 && <StepAnalyzeVisual isActive={isActive} />}
                      {idx === 3 && <StepVerifyVisual isActive={isActive} />}
                    </div>

                    {/* Animated bottom progress indicator */}
                    <motion.div
                      className="pipeline-progress-bar"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: isActive ? 1 : 0 }}
                      transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 08 — CAPABILITIES (Expandable Feature List with Micro-Diagrams) */}
        <section ref={capabilitiesRef} className="landing-features-section core-capabilities capabilities-section">
          <div className="landing-container landing-features-grid core-capabilities-grid capabilities-grid">
            <div className="features-left-col core-capabilities-visual capabilities-left">
              <div className="features-sticky-wrap sticky-image capabilities-image-sticky">
                <motion.div
                  className="features-left-visual"
                  aria-hidden="true"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 30, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.85, ease: EDITORIAL_EASE }}
                >
                  <motion.div
                    className="features-profile-img-wrap"
                    whileHover={{
                      scale: 1.02,
                      filter: "contrast(115%)",
                      transition: { duration: 0.5, ease: EDITORIAL_EASE },
                    }}
                  >
                    <motion.img
                      src={coreCapabilitiesProfileImg}
                      alt="Voice biometric profile and acoustic waveform"
                      className="features-profile-img"
                      animate={
                        shouldReduceMotion
                          ? {}
                          : {
                              scale: [1, 1.015, 1],
                            }
                      }
                      transition={{
                        repeat: Infinity,
                        duration: 7,
                        ease: "easeInOut",
                      }}
                    />
                  </motion.div>
                </motion.div>

                {/* LIVE SIGNAL STATUS telemetry panel below biometric image */}
                <LiveSignalStatusPanel shouldReduceMotion={shouldReduceMotion} />
              </div>
            </div>

            <div className="features-right-content core-capabilities-content">
              <motion.div
                className="features-header-row"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={fadeUpVariant}
              >
                <StaggeredHeadline
                  text={"CORE CAPABILITIES"}
                  as="h2"
                  className="landing-features-title"
                />
                <p className="features-header-desc">
                  Technologies powering real-time acoustic integrity.
                </p>
              </motion.div>

              <motion.div
                className="editorial-features-list"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={staggerContainerVariant}
              >
                {features.map((feat, idx) => {
                  const isExpanded = expandedFeature === idx;
                  return (
                    <motion.div
                      key={feat.num}
                      className={`editorial-feature-row ${isExpanded ? "expanded" : ""}`}
                      onClick={() => setExpandedFeature(isExpanded ? null : idx)}
                      variants={fadeUpVariant}
                    >
                      <div className="feature-row-top">
                        <span className="feature-num">{feat.num}</span>
                        <div className="feature-row-main">
                          <h3 className="feature-title">{feat.title}</h3>
                          <p className="feature-summary">{feat.summary}</p>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                className="feature-expanded-drawer"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: EDITORIAL_EASE }}
                              >
                                <div className="feature-expanded-inner">
                                  <p>{feat.details}</p>
                                  <div className="feature-visual-anchor-slot">
                                    {feat.visual}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <motion.span
                          className="feature-expand-toggle"
                          animate={{ rotate: isExpanded ? 45 : 0 }}
                          transition={{ duration: 0.25, ease: EDITORIAL_EASE }}
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          +
                        </motion.span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </section>

        {/* 09 — HOW IT WORKS (Horizontal Timeline with Connected Nodes) */}
        <section id="how-it-works" ref={howRef} className="landing-how-section">
          <div className="landing-container">
            <HeroVerificationAnimation />

            <motion.div
              className="how-timeline-track"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainerVariant}
            >
              {timelineSteps.map((st, idx) => (
                <motion.div
                  key={st.num}
                  className={`how-timeline-node ${activeTimelineStep === idx ? "active" : ""}`}
                  onClick={() => setActiveTimelineStep(idx)}
                  variants={fadeUpVariant}
                  whileHover={{ y: -4, transition: { duration: 0.2, ease: EDITORIAL_EASE } }}
                >
                  <div className="node-marker-wrap">
                    <span className="node-num">{st.num}</span>
                    <div className="node-connector" />
                  </div>
                  <div className="timeline-node-thumb-wrap">
                    <img src={st.image} alt={st.alt} className="timeline-node-thumb" />
                  </div>
                  <h3 className="node-title">{st.title}</h3>
                  <p className="node-desc">{st.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* 10 — FULL-BLEED VISUAL MOMENT 1 */}
        <section ref={fullBleedRef} className="full-bleed-visual-section" aria-label="Acoustic Visualization">
          <div className="full-bleed-container">
            <motion.div
              className="full-bleed-img-wrapper"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInVariant}
            >
              <motion.img
                src={distributedBannerImg}
                alt="High-precision acoustic analysis"
                className="full-bleed-photo"
                style={{ y: fullBleedImgY }}
              />
              <div className="full-bleed-overlay-caption">
                <div>
                  <span className="caption-tag">DISTRIBUTED INTEGRITY NETWORK</span>
                  <div className="caption-text">REAL-TIME ACOUSTIC INTEGRITY ACROSS PEER-TO-PEER CHANNELS</div>
                </div>
                <div className="caption-meta">LATENCY &lt; 15MS • IN-MEMORY DSP</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 11 — SECURITY & TRUST (Animated Peer-to-Peer Encryption Tunnel Diagram + Principles) */}
        <section id="security" className="landing-security-section">
          <div className="security-bg-watermark" aria-hidden="true">
            <img src={securityTunnelImg} alt="Encrypted security network background" />
          </div>

          <div className="landing-container" style={{ position: "relative", zIndex: 1 }}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUpVariant}
            >
              <StaggeredHeadline
                text={"VOICE SHOULD BE PERSONAL.\nAND VERIFIABLE."}
                as="h2"
                className="landing-security-title"
              />
              <p className="landing-security-subtitle">
                Engineered with privacy-by-design principles to protect biometric identity.
              </p>
            </motion.div>

            {/* Animated Peer-to-Peer Tunnel Diagram */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInVariant}
            >
              <SecurityTunnelVisual />
            </motion.div>

            {/* 4 Security Principles Cards */}
            <motion.div
              className="security-principles-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainerVariant}
            >
              <motion.div className="security-principle-item" variants={cardOddVariant} whileHover={{ y: -4 }}>
                <div className="security-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h4>Zero Audio Retention</h4>
                <p>No voice recordings are stored. All analysis happens transiently in local memory and is never written to disk.</p>
              </motion.div>

              <motion.div className="security-principle-item" variants={cardEvenVariant} whileHover={{ y: -4 }}>
                <div className="security-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M12 2a10 10 0 0 0-10 10c0 4.4 2.9 8.2 7 9.5" />
                    <path d="M12 6a6 6 0 0 0-6 6c0 2.2 1.2 4.1 3 5.1" />
                    <path d="M12 10a2 2 0 0 0-2 2" />
                  </svg>
                </div>
                <h4>Privacy-Preserving Biometrics</h4>
                <p>One-way 192-dimensional numerical vectors cannot reconstruct spoken words or synthesize vocal recordings.</p>
              </motion.div>

              <motion.div className="security-principle-item" variants={cardOddVariant} whileHover={{ y: -4 }}>
                <div className="security-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                </div>
                <h4>Supabase Row-Level Security</h4>
                <p>Voice profile vectors are protected with strict RLS policies, accessible only by authenticated profile owners.</p>
              </motion.div>

              <motion.div className="security-principle-item" variants={cardEvenVariant} whileHover={{ y: -4 }}>
                <div className="security-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>
                <h4>Automatic Memory Teardown</h4>
                <p>All transient speech buffers and analysis state are cleared from memory the moment a call terminates.</p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* 12 — FAQ SECTION (Smooth Framer Motion Accordion) */}
        <section id="faq" className="landing-faq-section">
          <div className="landing-container">
            <motion.div
              className="faq-header-row"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUpVariant}
            >
              <StaggeredHeadline
                text={"FREQUENTLY ASKED QUESTIONS"}
                as="h2"
                className="landing-faq-title"
              />
            </motion.div>

            <motion.div
              className="faq-accordion-list"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainerVariant}
            >
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <motion.div
                    key={idx}
                    className={`faq-item ${isOpen ? "is-open" : ""}`}
                    variants={fadeUpVariant}
                  >
                    <button
                      type="button"
                      className="faq-question-btn"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                    >
                      <span>{faq.q}</span>
                      <motion.span
                        className="faq-icon"
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ duration: 0.25, ease: EDITORIAL_EASE }}
                      >
                        +
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          className="faq-drawer"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.32, ease: EDITORIAL_EASE }}
                        >
                          <motion.div
                            className="faq-answer-inner"
                            initial={{ y: -8, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -6, opacity: 0 }}
                            transition={{ duration: 0.25, ease: EDITORIAL_EASE }}
                          >
                            <p>{faq.a}</p>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* 12b — FULL-BLEED BREAK 2: ACOUSTIC ENCLAVE */}
        <section className="full-bleed-visual-section" aria-label="Acoustic Enclave">
          <div className="full-bleed-container">
            <motion.div
              className="full-bleed-img-wrapper"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInVariant}
            >
              <motion.img
                src={finalCtaAtmosphereImg}
                alt="Hardware-isolated acoustic chamber and cryptographic integrity"
                className="full-bleed-photo"
              />
              <div className="full-bleed-overlay-caption">
                <div>
                  <span className="caption-tag">CRYPTOGRAPHIC INTEGRITY LAYER</span>
                  <div className="caption-text">ZERO-RETENTION VOLATILE MEMORY EXECUTION</div>
                </div>
                <div className="caption-meta">SUPABASE RLS • E2E WEBRTC ENCRYPTED</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 13 — FINAL CTA SECTION */}
        <section ref={ctaRef} className="landing-final-cta-section">
          <div className="landing-container">
            <div className="final-cta-grid">
              <motion.div
                className="final-cta-content"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={staggerContainerVariant}
              >
                <StaggeredHeadline
                  text={"TALK WITH CONFIDENCE."}
                  as="h2"
                  className="final-cta-title"
                />
                <motion.p className="final-cta-desc" variants={fadeUpVariant}>
                  Start a secure voice conversation with real-time acoustic integrity.
                </motion.p>
                <motion.div variants={fadeUpVariant}>
                  <MagneticButton
                    className="final-cta-btn"
                    onClick={onLaunchApp}
                  >
                    Launch VIRA &rarr;
                  </MagneticButton>
                </motion.div>
              </motion.div>

              <motion.div
                className="final-cta-image-wrapper"
                aria-hidden="true"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeInVariant}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3, ease: EDITORIAL_EASE }}
              >
                <motion.img
                  src={talkConfidenceImg}
                  alt="Acoustic analysis visualization"
                  className="final-cta-photo"
                  style={{ y: ctaImgY }}
                  animate={shouldReduceMotion ? {} : { scale: [1, 1.03, 1] }}
                  transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
                />
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      {/* 14 — FOOTER (Clean minimal with subtle dark waveform texture) */}
      <footer className="landing-footer" role="contentinfo">
        <div className="footer-texture-overlay" aria-hidden="true">
          <img src={finalCtaAtmosphereImg} alt="" className="footer-bg-img" />
        </div>
        <div className="landing-container" style={{ position: "relative", zIndex: 1 }}>
          <div className="landing-footer-top">
            <div className="footer-brand-meta">
              <span className="footer-brand-title">VIRA</span>
              <p className="footer-tagline">
                VOICE INTEGRITY &amp; REAL-TIME AUTHENTICATION
              </p>
            </div>

            <div className="footer-links-row">
              <button onClick={() => scrollToSection("technology")}>Technology</button>
              <button onClick={() => scrollToSection("product")}>Product</button>
              <button onClick={() => scrollToSection("how-it-works")}>How it works</button>
              <button onClick={() => scrollToSection("security")}>Security</button>
              <button onClick={() => scrollToSection("faq")}>FAQ</button>
              <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Privacy</button>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <span>&copy; {new Date().getFullYear()} VIRA. All rights reserved.</span>
            <span>Real-Time Voice Verification System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
