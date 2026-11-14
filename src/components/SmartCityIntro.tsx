import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Activity, Building2, Recycle, Wind } from 'lucide-react';

export interface SmartCityIntroProps {
  onComplete?: () => void;
}

const INTRO_SESSION_KEY = 'smartcity_ai_intro_seen_v2';

export function triggerSmartCityIntroReplay() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smartcity:replay-intro'));
  }
}

interface BuildingSpec {
  id: string;
  x: number;
  width: number;
  height: number;
  depth: 'back' | 'mid' | 'front';
  spire?: boolean;
  stepped?: boolean;
  delay: number;
  windows: Array<{ wx: number; wy: number; wDelay: number; accent?: 'cyan' | 'green' }>;
}

function buildSkyline(): BuildingSpec[] {
  const specs: Array<{
    id: string;
    x: number;
    width: number;
    height: number;
    depth: 'back' | 'mid' | 'front';
    spire?: boolean;
    stepped?: boolean;
    delay: number;
    cols: number;
    rows: number;
  }> = [
    { id: 'b1', x: 64, width: 46, height: 118, depth: 'back', delay: 0.08, cols: 3, rows: 6 },
    { id: 'b2', x: 120, width: 54, height: 162, depth: 'mid', stepped: true, delay: 0.16, cols: 4, rows: 8 },
    { id: 'b3', x: 186, width: 42, height: 136, depth: 'back', delay: 0.22, cols: 3, rows: 7 },
    { id: 'b4', x: 242, width: 64, height: 224, depth: 'front', spire: true, delay: 0.12, cols: 4, rows: 11 },
    { id: 'b5', x: 320, width: 52, height: 178, depth: 'mid', stepped: true, delay: 0.26, cols: 4, rows: 9 },
    { id: 'b6', x: 386, width: 72, height: 258, depth: 'front', spire: true, stepped: true, delay: 0.04, cols: 5, rows: 13 },
    { id: 'b7', x: 472, width: 58, height: 204, depth: 'mid', delay: 0.2, cols: 4, rows: 10 },
    { id: 'b8', x: 544, width: 66, height: 238, depth: 'front', spire: true, delay: 0.14, cols: 4, rows: 12 },
    { id: 'b9', x: 624, width: 48, height: 164, depth: 'mid', stepped: true, delay: 0.3, cols: 3, rows: 8 },
    { id: 'b10', x: 686, width: 56, height: 192, depth: 'front', delay: 0.18, cols: 4, rows: 9 },
    { id: 'b11', x: 756, width: 46, height: 142, depth: 'back', delay: 0.28, cols: 3, rows: 7 },
    { id: 'b12', x: 816, width: 52, height: 158, depth: 'mid', delay: 0.24, cols: 3, rows: 8 },
  ];

  const baseY = 390;
  return specs.map((b) => {
    const windows: BuildingSpec['windows'] = [];
    const padX = 7;
    const padY = 12;
    const cellW = (b.width - padX * 2) / b.cols;
    const cellH = (b.height - padY * 2) / b.rows;
    const topY = baseY - b.height;

    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const seed = (r * 7 + c * 13 + b.x) % 11;
        if (seed === 0 || seed === 4 || seed === 9) continue;
        windows.push({
          wx: b.x + padX + c * cellW + 1.5,
          wy: topY + padY + r * cellH + 1.5,
          wDelay: b.delay + 0.32 + ((r * b.cols + c) % 10) * 0.055,
          accent: seed === 7 ? 'green' : 'cyan',
        });
      }
    }

    return {
      id: b.id,
      x: b.x,
      width: b.width,
      height: b.height,
      depth: b.depth,
      spire: b.spire,
      stepped: b.stepped,
      delay: b.delay,
      windows,
    };
  });
}

const NETWORK_LINKS = [
  { id: 'link-1', d: 'M 147 228 Q 210 155 274 166', dur: 1.5, delay: 0 },
  { id: 'link-2', d: 'M 274 166 Q 348 110 422 132', dur: 1.35, delay: 0.15 },
  { id: 'link-3', d: 'M 422 132 Q 500 96 577 152', dur: 1.4, delay: 0.25 },
  { id: 'link-4', d: 'M 577 152 Q 645 140 714 198', dur: 1.45, delay: 0.1 },
  { id: 'link-5', d: 'M 274 166 Q 422 218 577 152', dur: 1.8, delay: 0.35 },
  { id: 'link-6', d: 'M 94 272 Q 190 240 346 212', dur: 1.65, delay: 0.2 },
];

const CONNECTIVITY_NODES = [
  { id: 'traffic', label: 'Traffic Grid', x: '24%', y: '34%', icon: Activity, color: '#00C8FF', delay: 0.08 },
  { id: 'environment', label: 'Air & Climate', x: '39%', y: '23%', icon: Wind, color: '#00D69A', delay: 0.18 },
  { id: 'waste', label: 'Waste AI', x: '61%', y: '25%', icon: Recycle, color: '#00D69A', delay: 0.28 },
  { id: 'infra', label: 'Civic Assets', x: '75%', y: '36%', icon: Building2, color: '#00C8FF', delay: 0.36 },
];

export function SmartCityIntro({ onComplete }: SmartCityIntroProps) {
  const prefersReducedMotion = useReducedMotion();

  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('replayIntro') === '1') {
        sessionStorage.removeItem(INTRO_SESSION_KEY);
      }
      return sessionStorage.getItem(INTRO_SESSION_KEY) !== '1';
    } catch {
      return true;
    }
  });

  // Scene progression: 1 (0-1s) -> 2 (1-2.5s) -> 3 (2.5-3.5s) -> 4 (3.5-5s) -> 5 (5-6s) -> 6 (6-6.7s exit)
  const [scene, setScene] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [isExiting, setIsExiting] = useState(false);
  const [replayRunId, setReplayRunId] = useState(0);
  const completedRef = useRef(false);
  const manualReplayRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const buildings = useMemo(() => buildSkyline(), []);

  const finishIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    } catch {
      // Ignore storage access restrictions
    }
    setIsExiting(true);
    const shouldReduce = Boolean(prefersReducedMotion) && !manualReplayRef.current;
    exitTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, shouldReduce ? 260 : 650);
  };

  useEffect(() => {
    const handleReplay = () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      manualReplayRef.current = true;
      completedRef.current = false;
      setIsExiting(false);
      setScene(1);
      setVisible(true);
      setReplayRunId((n) => n + 1);
    };
    window.addEventListener('smartcity:replay-intro', handleReplay);
    return () => window.removeEventListener('smartcity:replay-intro', handleReplay);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const shouldReduce = prefersReducedMotion === true && !manualReplayRef.current;
    if (shouldReduce) {
      setScene(5);
      const t = window.setTimeout(finishIntro, 1100);
      return () => {
        window.clearTimeout(t);
        if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
      };
    }

    const timers: number[] = [
      window.setTimeout(() => setScene(2), 950),
      window.setTimeout(() => setScene(3), 2450),
      window.setTimeout(() => setScene(4), 3500),
      window.setTimeout(() => setScene(5), 5000),
      window.setTimeout(() => {
        setScene(6);
        finishIntro();
      }, 6050),
    ];

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, [visible, prefersReducedMotion, replayRunId]);

  if (!visible) return null;

  const reduceMotion = prefersReducedMotion === true && !manualReplayRef.current;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="smartcity-intro-overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: isExiting ? 0 : 1 }}
          transition={{ duration: reduceMotion ? 0.25 : 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[120] overflow-hidden bg-[#070D18] text-[#F4F7FC] select-none"
          role="dialog"
          aria-modal="true"
          aria-label="SmartCity AI Command Initialization"
        >
          <motion.div
            key={`intro-run-${replayRunId}`}
            initial={{ scale: 1, opacity: 1 }}
            animate={
              isExiting
                ? { scale: reduceMotion ? 1 : 0.92, opacity: 0 }
                : { scale: 1, opacity: 1 }
            }
            transition={{ duration: reduceMotion ? 0.25 : 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-full flex flex-col items-center justify-center"
          >
          {/* Ambient radial depth vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 52%, rgba(0, 200, 255, 0.11) 0%, rgba(9, 19, 33, 0.72) 45%, #070D18 82%)',
            }}
          />

          {/* Scene 1+: Faint Precision Digital Perspective Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: scene >= 4 ? 0.22 : 0.42 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(0, 200, 255, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 200, 255, 0.08) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 75% 65% at 50% 52%, black 20%, transparent 100%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 75% 65% at 50% 52%, black 20%, transparent 100%)',
            }}
          />

          {/* Subtle horizontal horizon scanline */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: scene >= 1 ? 0.55 : 0, scaleX: scene >= 1 ? 1 : 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute bottom-[22%] left-1/2 -translate-x-1/2 h-px w-[min(86vw,960px)] bg-gradient-to-r from-transparent via-[#00C8FF]/60 to-transparent"
          />

          {/* Top bar: subtle telemetry tag + Skip button */}
          <div className="absolute top-5 right-5 left-5 flex items-center justify-between z-30">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 0.75, y: 0 }}
              transition={{ duration: 0.5 }}
              className="hidden sm:flex items-center gap-2 text-[11px] font-mono tracking-[0.18em] text-[#91A2B8] uppercase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C8FF]" />
              <span>INNOVEX 2026 // URBAN INTELLIGENCE KERNEL</span>
            </motion.div>

            <button
              type="button"
              onClick={finishIntro}
              className="ml-auto px-3.5 py-1.5 rounded-lg bg-[#091321]/80 hover:bg-[#101D2D] border border-[#00C8FF]/30 hover:border-[#00C8FF]/70 text-xs font-medium tracking-wide text-[#91A2B8] hover:text-[#F4F7FC] transition-colors backdrop-blur-md cursor-pointer"
              aria-label="Skip opening animation"
            >
              Skip Intro →
            </button>
          </div>

          {/* SCENE 1: Central Particle & Electronic Pulse (0-1s, gracefully recedes as skyline rises) */}
          <AnimatePresence>
            {scene <= 2 && !reduceMotion && (
              <motion.div
                key="scene-1-pulse"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.15 }}
                transition={{ duration: 0.55 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center z-10"
              >
                {/* Core cyan particle */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.35, 1], opacity: [0, 1, 0.9] }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  className="w-2.5 h-2.5 rounded-full bg-[#00C8FF] shadow-[0_0_24px_6px_rgba(0,200,255,0.85)]"
                />
                {/* Expanding electronic pulse rings */}
                {[0, 0.25].map((delay, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0.1, opacity: 0.85 }}
                    animate={{ scale: 4.8, opacity: 0 }}
                    transition={{ duration: 1.15, delay, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute w-24 h-24 rounded-full border border-[#00C8FF]/70"
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* SCENE 2 & 3: Futuristic Mumbai-Inspired Wireframe Skyline + Smart Connectivity Network */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: scene >= 2 ? (scene >= 4 ? 0.28 : 1) : 0,
              scale: scene >= 4 ? 0.96 : 1,
              y: scene >= 4 ? 22 : 0,
            }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none relative w-full max-w-[980px] px-4 flex items-center justify-center z-10"
          >
            <div className="relative w-full aspect-[920/420]">
              <svg
                viewBox="0 0 920 420"
                className="w-full h-full overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="skylineStrokeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00C8FF" stopOpacity="0.95" />
                    <stop offset="55%" stopColor="#00D69A" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#00C8FF" stopOpacity="0.95" />
                  </linearGradient>
                  <linearGradient id="buildingFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#091321" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#070D18" stopOpacity="0.96" />
                  </linearGradient>
                  <linearGradient id="energySweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00C8FF" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#00D69A" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#00C8FF" stopOpacity="0.1" />
                  </linearGradient>
                  <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Subtle Sea Link cable-stayed silhouette in far left parallax layer */}
                {scene >= 2 && (
                  <motion.g
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 0.45, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.15 }}
                  >
                    <path
                      d="M 20 390 L 210 382 L 420 390"
                      stroke="#00C8FF"
                      strokeOpacity="0.4"
                      strokeWidth="1.2"
                      fill="none"
                    />
                    <path
                      d="M 105 385 L 118 292 L 130 385"
                      stroke="#00C8FF"
                      strokeOpacity="0.65"
                      strokeWidth="1.4"
                      fill="none"
                    />
                    <path
                      d="M 118 298 L 42 388 M 118 298 L 68 386 M 118 298 L 166 385 M 118 298 L 194 384"
                      stroke="#00C8FF"
                      strokeOpacity="0.3"
                      strokeWidth="0.9"
                      fill="none"
                    />
                  </motion.g>
                )}

                {/* Ground baseline glow */}
                <line
                  x1="36"
                  y1="390"
                  x2="884"
                  y2="390"
                  stroke="#00C8FF"
                  strokeOpacity="0.45"
                  strokeWidth="1.5"
                />

                {/* Rising Wireframe Skyscrapers */}
                {scene >= 2 &&
                  buildings.map((b) => {
                    const topY = 390 - b.height;
                    const strokeOpacity = b.depth === 'front' ? 0.92 : b.depth === 'mid' ? 0.62 : 0.36;
                    const strokeWidth = b.depth === 'front' ? 1.5 : 1.1;

                    return (
                      <motion.g
                        key={b.id}
                        initial={{ opacity: 0, y: b.depth === 'front' ? 32 : 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.72, delay: b.delay, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {/* Dark glass core */}
                        <rect
                          x={b.x}
                          y={topY}
                          width={b.width}
                          height={b.height}
                          fill="url(#buildingFillGrad)"
                        />

                        {/* Stepped crown */}
                        {b.stepped && (
                          <rect
                            x={b.x + 8}
                            y={topY - 16}
                            width={b.width - 16}
                            height={16}
                            fill="#091321"
                            stroke="#00C8FF"
                            strokeOpacity={strokeOpacity * 0.85}
                            strokeWidth={1}
                          />
                        )}

                        {/* Antenna / Spire */}
                        {b.spire && (
                          <g>
                            <line
                              x1={b.x + b.width / 2}
                              y1={b.stepped ? topY - 16 : topY}
                              x2={b.x + b.width / 2}
                              y2={(b.stepped ? topY - 16 : topY) - 28}
                              stroke="#00D69A"
                              strokeWidth="1.4"
                              strokeOpacity="0.9"
                            />
                            <circle
                              cx={b.x + b.width / 2}
                              cy={(b.stepped ? topY - 16 : topY) - 30}
                              r="2"
                              fill="#00D69A"
                            />
                          </g>
                        )}

                        {/* Animated Wireframe Outline */}
                        <motion.rect
                          x={b.x}
                          y={topY}
                          width={b.width}
                          height={b.height}
                          fill="none"
                          stroke="#00C8FF"
                          strokeOpacity={strokeOpacity}
                          strokeWidth={strokeWidth}
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.85, delay: b.delay, ease: 'easeOut' }}
                        />

                        {/* Sequentially Illuminated Windows */}
                        {b.windows.map((win, idx) => (
                          <motion.rect
                            key={idx}
                            x={win.wx}
                            y={win.wy}
                            width={4.5}
                            height={5.5}
                            rx={0.8}
                            fill={win.accent === 'green' ? '#00D69A' : '#00C8FF'}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: b.depth === 'back' ? 0.35 : 0.72 }}
                            transition={{ duration: 0.25, delay: win.wDelay }}
                          />
                        ))}
                      </motion.g>
                    );
                  })}

                {/* SCENE 3: Glowing Energy Ring Sweep & Animated Network Connections */}
                {scene >= 3 && (
                  <g>
                    {/* Sweeping cyan/green orbital arc around skyline */}
                    <motion.ellipse
                      cx="460"
                      cy="260"
                      rx="390"
                      ry="135"
                      fill="none"
                      stroke="url(#energySweepGrad)"
                      strokeWidth="2"
                      filter="url(#cyanGlow)"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.85 }}
                      transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
                    />

                    {/* Network paths + traveling particles */}
                    {NETWORK_LINKS.map((link) => (
                      <g key={link.id}>
                        <motion.path
                          d={link.d}
                          fill="none"
                          stroke="#00C8FF"
                          strokeWidth="1.4"
                          strokeDasharray="4 4"
                          strokeOpacity="0.65"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 0.75 }}
                          transition={{ duration: 0.65, delay: link.delay }}
                        />
                        <circle r="3.2" fill="#00D69A" filter="url(#cyanGlow)">
                          <animateMotion
                            dur={`${link.dur}s`}
                            repeatCount="indefinite"
                            path={link.d}
                            begin={`${link.delay}s`}
                          />
                        </circle>
                      </g>
                    ))}
                  </g>
                )}
              </svg>

              {/* Scene 3 Domain Node Micro-Badges */}
              {scene === 3 &&
                CONNECTIVITY_NODES.map((node) => {
                  const Icon = node.icon;
                  return (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, scale: 0.8, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, delay: node.delay, ease: 'easeOut' }}
                      style={{ left: node.x, top: node.y }}
                      className="hidden sm:flex -translate-x-1/2 -translate-y-1/2 absolute items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#091321]/85 border border-[#00C8FF]/35 backdrop-blur-md shadow-[0_0_16px_rgba(0,200,255,0.18)]"
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: node.color }} />
                      <span className="text-[11px] font-medium tracking-wide text-[#F4F7FC] whitespace-nowrap">
                        {node.label}
                      </span>
                    </motion.div>
                  );
                })}
            </div>
          </motion.div>

          {/* SCENE 4 & 5: Official SmartCity AI Logo Reveal & System Activation */}
          <AnimatePresence>
            {scene >= 4 && (
              <motion.div
                key="logo-activation-stage"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center pointer-events-none"
              >
                {/* Logo Mark: Orbital Ring + Minimalistic Skyline + Connectivity Signal */}
                <motion.div
                  initial={{ scale: 0.86, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                  className="relative mb-5 flex items-center justify-center"
                >
                  <div className="absolute inset-0 rounded-full bg-[#00C8FF]/15 blur-2xl scale-125" />
                  <svg
                    viewBox="0 0 120 120"
                    className="w-24 h-24 sm:w-28 sm:h-28 relative"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="logoSkylineGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00C8FF" />
                        <stop offset="100%" stopColor="#00D69A" />
                      </linearGradient>
                    </defs>

                    {/* Circular orbital ring */}
                    <motion.circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="rgba(9,19,33,0.72)"
                      stroke="url(#logoSkylineGrad)"
                      strokeWidth="2"
                      strokeDasharray="240 42"
                      initial={{ rotate: -45, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                      style={{ transformOrigin: '60px 60px' }}
                    />

                    {/* Smart connectivity signal arcs above skyline */}
                    <motion.path
                      d="M 46 36 Q 60 24 74 36"
                      fill="none"
                      stroke="#00C8FF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.95 }}
                      transition={{ duration: 0.5, delay: 0.22 }}
                    />
                    <motion.path
                      d="M 52 42 Q 60 34 68 42"
                      fill="none"
                      stroke="#00D69A"
                      strokeWidth="2"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.45, delay: 0.34 }}
                    />
                    <circle cx="60" cy="46" r="2.2" fill="#00D69A" />

                    {/* Minimalistic futuristic city skyline */}
                    <path
                      d="M 32 82 L 32 64 L 41 64 L 41 82 M 45 82 L 45 53 L 55 53 L 55 82 M 58 82 L 58 49 L 66 49 L 66 82 M 69 82 L 69 58 L 78 58 L 78 82 M 81 82 L 81 67 L 89 67 L 89 82 M 26 82 L 94 82"
                      fill="none"
                      stroke="url(#logoSkylineGrad)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>

                {/* Wordmark */}
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.12 }}
                  className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#F4F7FC] drop-shadow-[0_0_24px_rgba(0,200,255,0.28)]"
                >
                  SmartCity{' '}
                  <span className="bg-gradient-to-r from-[#00C8FF] to-[#00D69A] bg-clip-text text-transparent">
                    AI
                  </span>
                </motion.h1>

                {/* Tagline with smooth letter-spacing reveal */}
                <motion.p
                  initial={{ opacity: 0, letterSpacing: '0.14em' }}
                  animate={{ opacity: 0.92, letterSpacing: '0.28em' }}
                  transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-3 text-[11px] sm:text-xs font-mono uppercase text-[#91A2B8]"
                >
                  INTELLIGENCE FOR A SMARTER TOMORROW
                </motion.p>

                {/* SCENE 5: System Activation Readout & Smooth Progress Line */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: scene >= 5 ? 1 : 0, y: scene >= 5 ? 0 : 10 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="mt-8 w-full max-w-xs sm:max-w-sm flex flex-col items-center gap-2.5"
                >
                  <div className="w-full flex items-center justify-between text-[11px] font-mono tracking-[0.16em] text-[#91A2B8]">
                    <span>CITY COMMAND CENTER</span>
                    <span className="text-[#00C8FF]">SYSTEM INITIALIZED</span>
                  </div>

                  {/* Thin Cyan Progress Bar */}
                  <div className="w-full h-[2px] rounded-full bg-[#14243A] overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: scene >= 5 ? 1 : 0 }}
                      transition={{ duration: reduceMotion ? 0.25 : 0.85, ease: [0.16, 1, 0.3, 1] }}
                      style={{ transformOrigin: '0% 50%' }}
                      className="w-full h-full bg-gradient-to-r from-[#00C8FF] to-[#00D69A] shadow-[0_0_10px_#00C8FF]"
                    />
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-[11px] font-mono tracking-[0.16em] text-[#00D69A]">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#00D69A] shadow-[0_0_8px_#00D69A]" />
                    <span>ALL SYSTEMS OPERATIONAL</span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
