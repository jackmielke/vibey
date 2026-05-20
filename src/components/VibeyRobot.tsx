import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

type Theme = "light" | "dark";

function VibeyLoader({ theme }: { theme: Theme }) {
  const palette =
    theme === "light"
      ? {
          bg: "bg-spec-surface",
          ring: "border-spec-ink/10",
          arc: "border-spec-accent",
          ink: "text-spec-ink/70",
          muted: "text-spec-ink/40",
          bar: "bg-spec-accent",
          barBg: "bg-spec-ink/10",
        }
      : {
          bg: "bg-background",
          ring: "border-white/10",
          arc: "border-primary",
          ink: "text-white/80",
          muted: "text-white/40",
          bar: "bg-primary",
          barBg: "bg-white/10",
        };

  const phrases = ["booting kernel", "linking telegram", "loading vibe vectors", "calibrating gestures", "saying hello"];
  const [phrase, setPhrase] = useState(phrases[0]);
  const [pct, setPct] = useState(2);

  useEffect(() => {
    let i = 0;
    const tPhrase = setInterval(() => {
      i = (i + 1) % phrases.length;
      setPhrase(phrases[i]);
    }, 700);
    const tPct = setInterval(() => setPct((p) => (p < 96 ? p + Math.random() * 6 : p + 0.2)), 180);
    return () => {
      clearInterval(tPhrase);
      clearInterval(tPct);
    };
  }, []);

  return (
    <div className={`absolute inset-0 ${palette.bg} flex flex-col items-center justify-center select-none`}>
      <div className="relative size-28">
        <div className={`absolute inset-0 rounded-full border ${palette.ring}`} />
        <div className={`absolute inset-2 rounded-full border ${palette.ring}`} />
        <div
          className={`absolute inset-0 rounded-full border-2 border-transparent ${palette.arc} animate-spin`}
          style={{ borderRightColor: "transparent", borderBottomColor: "transparent", animationDuration: "1.4s" }}
        />
        <div
          className={`absolute inset-3 rounded-full border-2 border-transparent ${palette.arc} animate-spin`}
          style={{ borderTopColor: "transparent", borderLeftColor: "transparent", animationDuration: "2.2s", animationDirection: "reverse" }}
        />
        <div className={`absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-widest ${palette.muted}`}>
          {Math.min(99, Math.floor(pct))}%
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <span className={`font-mono text-[10px] uppercase tracking-[0.3em] ${palette.muted}`}>// initializing vibey</span>
        <span className={`font-mono text-xs ${palette.ink}`}>{phrase}…</span>
      </div>

      <div className={`mt-6 h-px w-48 ${palette.barBg} overflow-hidden`}>
        <div
          className={`h-full ${palette.bar} transition-[width] duration-200 ease-out`}
          style={{ width: `${Math.min(99, pct)}%` }}
        />
      </div>
    </div>
  );
}

function Robot({
  url,
  action,
  scale,
  yOffset,
  onReady,
}: {
  url: string;
  action: string;
  scale: number;
  yOffset: number;
  onReady: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);
  const t0 = useRef<number | null>(null);

  useEffect(() => {
    if (!actions || !names.length) return;
    Object.values(actions).forEach((a) => a?.fadeOut(0.3));
    const isIdle = action.toLowerCase().includes("idle");
    const target =
      actions[action] ??
      actions[names.find((n) => n.toLowerCase() === action.toLowerCase()) ?? ""] ??
      actions[names.find((n) => n.toLowerCase().includes("idle")) ?? ""] ??
      actions[names[0] ?? ""];
    if (target) {
      target.reset();
      if (isIdle) {
        target.setLoop(THREE.LoopRepeat, Infinity);
        target.clampWhenFinished = false;
      } else {
        target.setLoop(THREE.LoopOnce, 1);
        target.clampWhenFinished = true;
      }
      target.fadeIn(0.3).play();
    }
  }, [action, actions, names]);

  useEffect(() => {
    const id = requestAnimationFrame(() => onReady());
    return () => cancelAnimationFrame(id);
  }, [onReady]);

  useFrame((state) => {
    if (!group.current) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime;
    const intro = Math.min(1, (t - t0.current) / 0.9);
    const eased = 1 - Math.pow(1 - intro, 3);
    group.current.scale.setScalar(scale * eased);
    group.current.rotation.y = Math.sin(t * 0.4) * 0.18 + state.pointer.x * 0.4;
    group.current.position.y = yOffset + Math.sin(t * 1.2) * 0.04 + (1 - eased) * -0.3;
  });

  return (
    <group ref={group} dispose={null} scale={0}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/robot-expressive.glb");

function SceneInner({
  url,
  action,
  scale,
  yOffset,
  onReady,
}: {
  url: string;
  action: string;
  scale: number;
  yOffset: number;
  onReady: () => void;
}) {
  return (
    <Suspense fallback={null}>
      <Robot url={url} action={action} scale={scale} yOffset={yOffset} onReady={onReady} />
      <ContactShadows position={[0, yOffset - 0.02, 0]} opacity={0.3} scale={6} blur={2.4} far={2} />
    </Suspense>
  );
}

export function RobotScene({
  url = "/models/robot-expressive.glb",
  theme = "light",
  initialAction = "Wave",
  moves = ["Wave", "Yes", "ThumbsUp", "Jump", "Dance", "Idle"],
  scale = 0.55,
  yOffset = -1.4,
  cameraZ = 6,
  rimColor,
  showControls = true,
}: {
  url?: string;
  theme?: Theme;
  initialAction?: string;
  moves?: string[];
  scale?: number;
  yOffset?: number;
  cameraZ?: number;
  rimColor?: string;
  showControls?: boolean;
}) {
  const [action, setAction] = useState<string>("Idle");
  const [ready, setReady] = useState(false);
  const [hideLoader, setHideLoader] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setHideLoader(true), 700);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (!ready || hasGreeted) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.4) {
            setHasGreeted(true);
            obs.disconnect();
          }
        }
      },
      { threshold: [0, 0.4, 0.7] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ready, hasGreeted]);

  useEffect(() => {
    if (!hasGreeted) return;
    const sequence = [initialAction, ...moves.filter((m) => m !== initialAction && m.toLowerCase() !== "idle")];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    timeouts.push(
      setTimeout(() => {
        if (userInteractedRef.current) return;
        setAction(sequence[0]);
      }, 800),
    );
    sequence.slice(1).forEach((m, i) => {
      timeouts.push(
        setTimeout(() => {
          if (userInteractedRef.current) return;
          setAction(m);
        }, 800 + (i + 1) * 4000),
      );
    });
    timeouts.push(
      setTimeout(() => {
        if (userInteractedRef.current) return;
        setAction("Idle");
      }, 800 + sequence.length * 4000),
    );
    return () => timeouts.forEach(clearTimeout);
  }, [hasGreeted, initialAction, moves]);

  const buttonStyles =
    theme === "dark"
      ? {
          base: "border-white/15 bg-black/20 text-white/55 hover:text-white hover:border-primary/60 hover:bg-primary/10 backdrop-blur-sm",
          active: "border-primary text-primary bg-primary/15 shadow-[0_0_24px_-12px_hsl(var(--primary))] backdrop-blur-sm",
        }
      : {
          base: "border-black/15 bg-white/25 text-black/50 hover:text-black/80 hover:border-black/40 backdrop-blur-sm",
          active: "border-spec-accent text-spec-accent bg-spec-accent/5",
        };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
        <Canvas
          camera={{ position: [0, 0.6, cameraZ], fov: 35 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          className="!bg-transparent"
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 6, 5]} intensity={1.4} />
          <directionalLight
            position={[-5, 3, -3]}
            intensity={0.6}
            color={rimColor ?? (theme === "dark" ? "#3aa9ff" : "#ff3b00")}
          />
          <SceneInner url={url} action={action} scale={scale} yOffset={yOffset} onReady={() => setReady(true)} />
        </Canvas>
      </div>

      {!hideLoader && (
        <div className={`transition-opacity duration-500 ${ready ? "opacity-0" : "opacity-100"}`}>
          <VibeyLoader theme={theme} />
        </div>
      )}

      {showControls && (
        <div
          className={`absolute bottom-3 left-3 right-3 flex flex-wrap justify-center gap-1.5 transition-opacity duration-500 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        >
          {moves.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                userInteractedRef.current = true;
                setAction(m);
              }}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
                action === m ? buttonStyles.active : buttonStyles.base
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
