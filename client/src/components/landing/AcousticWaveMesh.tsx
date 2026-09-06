import React, { useRef, useEffect } from "react";
import { useReducedMotion } from "framer-motion";

interface AcousticWaveMeshProps {
  className?: string;
}

export const AcousticWaveMesh: React.FC<AcousticWaveMeshProps> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1));
    let height = (canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      height = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width;
      const normY = (e.clientY - rect.top) / rect.height;
      mouseRef.current.targetX = Math.max(0, Math.min(1, normX));
      mouseRef.current.targetY = Math.max(0, Math.min(1, normY));
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    let phase = 0;
    const lineCount = 14;

    const render = () => {
      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const dpr = window.devicePixelRatio || 1;
      const centerY = height * 0.5;
      const amplitude = height * 0.28;

      for (let i = 0; i < lineCount; i++) {
        const lineOffset = (i / lineCount) * Math.PI * 2;
        const opacity = 0.05 + (i / lineCount) * 0.14;
        
        ctx.beginPath();
        ctx.lineWidth = 1 * dpr;
        ctx.strokeStyle = `rgba(10, 10, 10, ${opacity})`;

        const points = 80;
        for (let j = 0; j <= points; j++) {
          const x = (j / points) * width;
          const normX = j / points;
          
          // Gaussian envelope spanning across the full background width
          const envelope = Math.exp(-Math.pow((normX - 0.5) / 0.38, 2));

          // Multi-frequency harmonic superposition
          const mouseInfluence = (mouseRef.current.y - 0.5) * 50 * dpr;
          const y =
            centerY +
            Math.sin(normX * 8 + phase + lineOffset) * amplitude * envelope +
            Math.cos(normX * 16 - phase * 0.8 + lineOffset) * (amplitude * 0.35) * envelope +
            mouseInfluence * envelope;

          if (j === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      if (!shouldReduceMotion) {
        phase += 0.018;
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [shouldReduceMotion]);

  return (
    <div className={`acoustic-mesh-container ${className}`}>
      <canvas ref={canvasRef} className="acoustic-mesh-canvas" />
    </div>
  );
};
