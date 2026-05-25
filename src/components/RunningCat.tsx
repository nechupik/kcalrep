import { useEffect, useRef, useState } from "react";

function CatSVG({ frame }: { frame: 0 | 1 }) {
  const legs = frame === 0
    ? { bl: [26, 44, 10], br: [34, 40, 6], fl: [50, 40, 6], fr: [58, 44, 10] }
    : { bl: [26, 40, 6],  br: [34, 44, 10], fl: [50, 44, 10], fr: [58, 40, 6] };

  return (
    <svg width="76" height="56" viewBox="0 0 76 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 36 Q5 24 8 11 Q9 7 14 10" stroke="#a855f7" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="35" cy="37" rx="19" ry="11" fill="#7c3aed"/>
      <circle cx="57" cy="25" r="13" fill="#7c3aed"/>
      <polygon points="47,16 50,7 56,15" fill="#7c3aed"/>
      <polygon points="58,15 64,7 67,16" fill="#7c3aed"/>
      <polygon points="48,15 51,10 55,15" fill="#c084fc" opacity="0.6"/>
      <polygon points="59,15 64,10 66,15" fill="#c084fc" opacity="0.6"/>
      <circle cx="61" cy="23" r="3" fill="#0f0a1e"/>
      <circle cx="62" cy="22" r="1" fill="white"/>
      <ellipse cx="69" cy="28" rx="1.5" ry="1" fill="#f9a8d4"/>
      <path d="M68 29 Q69 31 70 29" stroke="#f9a8d4" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <line x1="69" y1="26.5" x2="76" y2="24" stroke="#c084fc" strokeWidth="0.9" opacity="0.7"/>
      <line x1="69" y1="28.5" x2="76" y2="28.5" stroke="#c084fc" strokeWidth="0.9" opacity="0.7"/>
      <rect x={legs.bl[0]} y={legs.bl[1]} width="7" height={legs.bl[2]} rx="3.5" fill="#6d28d9"/>
      <rect x={legs.br[0]} y={legs.br[1]} width="7" height={legs.br[2]} rx="3.5" fill="#6d28d9"/>
      <rect x={legs.fl[0]} y={legs.fl[1]} width="7" height={legs.fl[2]} rx="3.5" fill="#6d28d9"/>
      <rect x={legs.fr[0]} y={legs.fr[1]} width="7" height={legs.fr[2]} rx="3.5" fill="#6d28d9"/>
    </svg>
  );
}

// Returns a random run config: start/end positions (CSS strings) + rotation angle
function randomRun() {
  const O = 90; // off-screen offset px
  const rh = () => `${15 + Math.floor(Math.random() * 70)}vh`; // random height
  const rx = () => `${10 + Math.floor(Math.random() * 80)}vw`; // random x

  const options = [
    // Horizontal — various heights
    { x0: `-${O}px`,               y0: rh(), x1: `calc(100vw + ${O}px)`, y1: rh(), rot: 0   },
    { x0: `calc(100vw + ${O}px)`,  y0: rh(), x1: `-${O}px`,              y1: rh(), rot: 180 },
    // Vertical
    { x0: rx(), y0: `-${O}px`,               x1: rx(), y1: `calc(100vh + ${O}px)`, rot: 90  },
    { x0: rx(), y0: `calc(100vh + ${O}px)`,  x1: rx(), y1: `-${O}px`,              rot: -90 },
    // Diagonals
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
        const duration = 6 + Math.random() * 4;
        const animId = `cat${Date.now()}`;
        setRun({ ...r, duration, animId });
        setFrame(0);

        stepRef.current = setInterval(() => setFrame(f => (f === 0 ? 1 : 0)), 150);

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
        @keyframes catBounce {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-5px); }
        }
        .cat-bounce-step {
          display: inline-block;
          animation: catBounce 0.3s ease-in-out infinite;
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
          <div className="cat-bounce-step">
            <CatSVG frame={frame} />
          </div>
        </div>
      </div>
    </>
  );
}
