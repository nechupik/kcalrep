import { useEffect, useRef, useState } from "react";

function CapybaraSVG({ frame }: { frame: 0 | 1 }) {
  const legOff = frame === 0
    ? { bl: 2, br: -2, fl: -2, fr: 2 }
    : { bl: -2, br: 2, fl: 2, fr: -2 };

  return (
    <svg width="100" height="62" viewBox="0 0 100 62" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body — massive barrel shape */}
      <ellipse cx="42" cy="36" rx="30" ry="17" fill="#7c3aed"/>
      {/* Belly lighter */}
      <ellipse cx="42" cy="40" rx="24" ry="11" fill="#8b5cf6" opacity="0.35"/>

      {/* Head — big boxy/rectangular, capybara signature shape */}
      <rect x="62" y="16" width="28" height="24" rx="10" fill="#7c3aed"/>
      {/* Flat snout — blunt squared muzzle sticking out front */}
      <rect x="82" y="22" width="14" height="14" rx="6" fill="#8b5cf6"/>

      {/* Nose — large dark oval on the very tip */}
      <ellipse cx="94" cy="26" rx="3.5" ry="2.5" fill="#2e1065"/>
      {/* Nostrils */}
      <circle cx="92.5" cy="25.8" r="1" fill="#1a0533"/>
      <circle cx="95.5" cy="25.8" r="1" fill="#1a0533"/>

      {/* Eye — small, placed high on the head */}
      <circle cx="72" cy="22" r="3" fill="#0f0a1e"/>
      <circle cx="72.8" cy="21.2" r="1.1" fill="white"/>

      {/* Ears — very small, rounded, on top of head */}
      <ellipse cx="68" cy="15" rx="3.5" ry="4.5" fill="#6d28d9"/>
      <ellipse cx="68" cy="15" rx="2" ry="2.8" fill="#c084fc" opacity="0.35"/>
      <ellipse cx="76" cy="14.5" rx="3.5" ry="4.5" fill="#6d28d9"/>
      <ellipse cx="76" cy="14.5" rx="2" ry="2.8" fill="#c084fc" opacity="0.35"/>

      {/* Mouth — subtle line */}
      <path d="M90 32 Q92 34 94 32" stroke="#2e1065" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

      {/* Cheek / jaw area */}
      <ellipse cx="80" cy="34" rx="6" ry="4" fill="#7c3aed"/>

      {/* Back legs — short and thick */}
      <rect x="18" y={44 + legOff.bl} width="10" height="14" rx="5" fill="#6d28d9"/>
      <rect x="32" y={44 + legOff.br} width="10" height="14" rx="5" fill="#6d28d9"/>
      {/* Front legs */}
      <rect x="56" y={44 + legOff.fl} width="10" height="14" rx="5" fill="#6d28d9"/>
      <rect x="68" y={44 + legOff.fr} width="10" height="14" rx="5" fill="#6d28d9"/>

      {/* Tiny nub tail */}
      <circle cx="12" cy="33" r="3" fill="#6d28d9"/>
    </svg>
  );
}

function randomRun() {
  const O = 100;
  const rh = () => `${15 + Math.floor(Math.random() * 70)}vh`;
  const rx = () => `${10 + Math.floor(Math.random() * 80)}vw`;

  const options = [
    { x0: `-${O}px`,               y0: rh(), x1: `calc(100vw + ${O}px)`, y1: rh(), rot: 0   },
    { x0: `calc(100vw + ${O}px)`,  y0: rh(), x1: `-${O}px`,              y1: rh(), rot: 180 },
    { x0: rx(), y0: `-${O}px`,               x1: rx(), y1: `calc(100vh + ${O}px)`, rot: 90  },
    { x0: rx(), y0: `calc(100vh + ${O}px)`,  x1: rx(), y1: `-${O}px`,              rot: -90 },
    { x0: `-${O}px`,              y0: `-${O}px`,              x1: `calc(100vw + ${O}px)`, y1: `calc(100vh + ${O}px)`, rot: 45   },
    { x0: `calc(100vw + ${O}px)`, y0: `-${O}px`,              x1: `-${O}px`,              y1: `calc(100vh + ${O}px)`, rot: 135  },
    { x0: `-${O}px`,              y0: `calc(100vh + ${O}px)`, x1: `calc(100vw + ${O}px)`, y1: `-${O}px`,              rot: -45  },
    { x0: `calc(100vw + ${O}px)`, y0: `calc(100vh + ${O}px)`, x1: `-${O}px`,             y1: `-${O}px`,              rot: -135 },
  ];
  return options[Math.floor(Math.random() * options.length)];
}

interface RunConfig {
  x0: string; y0: string;
  x1: string; y1: string;
  rot: number;
  duration: number;
  animId: string;
}

export function RunningCat() {
  const [run, setRun] = useState<RunConfig | null>(null);
  const [frame, setFrame] = useState<0 | 1>(0);
  const scheduleRef = useRef<ReturnType<typeof setTimeout>>();
  const hideRef    = useRef<ReturnType<typeof setTimeout>>();
  const stepRef    = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    function schedule() {
      const delay = 15_000 + Math.random() * 45_000;
      scheduleRef.current = setTimeout(() => {
        const r = randomRun();
        const duration = 7 + Math.random() * 4;
        const animId = `capy${Date.now()}`;
        setRun({ ...r, duration, animId });
        setFrame(0);

        stepRef.current = setInterval(() => setFrame(f => (f === 0 ? 1 : 0)), 200);

        hideRef.current = setTimeout(() => {
          setRun(null);
          clearInterval(stepRef.current);
          schedule();
        }, (duration + 0.3) * 1000);
      }, delay);
    }

    schedule();
    return () => {
      clearTimeout(scheduleRef.current);
      clearTimeout(hideRef.current);
      clearInterval(stepRef.current);
    };
  }, []);

  if (!run) return null;

  const { x0, y0, x1, y1, rot, duration, animId } = run;

  return (
    <>
      <style>{`
        @keyframes ${animId} {
          from { left: ${x0}; top: ${y0}; }
          to   { left: ${x1}; top: ${y1}; }
        }
        @keyframes capyWaddle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          30%      { transform: translateY(-2px) rotate(-1.5deg); }
          70%      { transform: translateY(-2px) rotate(1.5deg); }
        }
        .capy-waddle {
          display: inline-block;
          animation: capyWaddle 0.4s ease-in-out infinite;
        }
      `}</style>

      <div style={{
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 9999,
        pointerEvents: "none",
        userSelect: "none",
        animation: `${animId} ${duration}s linear forwards`,
      }}>
        <div style={{ transform: `rotate(${rot}deg)`, transformOrigin: "center center" }}>
          <div className="capy-waddle">
            <CapybaraSVG frame={frame} />
          </div>
        </div>
      </div>
    </>
  );
}
