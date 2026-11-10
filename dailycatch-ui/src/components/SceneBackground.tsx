import { useEffect, useRef } from "react";
import { SeasonField, type Season } from "./SeasonField";

type Dot = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
};

type Burst = { x: number; y: number; t: number };

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots: Dot[] = [];
    const bursts: Burst[] = [];
    const mouse = { x: -9999, y: -9999, inside: false };
    let width = 0;
    let height = 0;
    let frame = 0;
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(200, Math.max(110, (width * height) / 12000)));
      dots.length = 0;
      for (let index = 0; index < count; index += 1) {
        dots.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: Math.random() ** 1.4,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          phase: Math.random() * Math.PI * 2,
          size: 0.7 + Math.random() ** 2 * 2.4,
        });
      }
    }

    function onMove(event: PointerEvent) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.inside = true;
    }

    function onLeave() {
      mouse.inside = false;
    }

    function onDown(event: PointerEvent) {
      bursts.push({ x: event.clientX, y: event.clientY, t: 0 });
      if (bursts.length > 4) {
        bursts.shift();
      }
    }

    function step() {
      frame += 1;
      ctx!.clearRect(0, 0, width, height);
      const parallaxX = mouse.inside ? (mouse.x - width / 2) * 0.02 : 0;
      const parallaxY = mouse.inside ? (mouse.y - height / 2) * 0.02 : 0;

      for (const burst of bursts) {
        burst.t += 0.012;
      }
      for (let index = bursts.length - 1; index >= 0; index -= 1) {
        if (bursts[index].t > 1) {
          bursts.splice(index, 1);
        }
      }

      if (!reduce) {
        for (const dot of dots) {
          dot.x += dot.vx * (0.25 + dot.z);
          dot.y += dot.vy * (0.25 + dot.z);
          if (mouse.inside) {
            const dx = dot.x - mouse.x;
            const dy = dot.y - mouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 130 && dist > 0.01) {
              const push = ((130 - dist) / 130) * 0.9;
              dot.x += (dx / dist) * push;
              dot.y += (dy / dist) * push;
            }
          }
          if (dot.x < -24) {
            dot.x = width + 24;
          } else if (dot.x > width + 24) {
            dot.x = -24;
          }
          if (dot.y < -24) {
            dot.y = height + 24;
          } else if (dot.y > height + 24) {
            dot.y = -24;
          }
        }
      }

      const link = 108;
      for (let i = 0; i < dots.length; i += 1) {
        const a = dots[i];
        if (a.z < 0.35) {
          continue;
        }
        for (let j = i + 1; j < dots.length; j += 1) {
          const b = dots[j];
          if (b.z < 0.35) {
            continue;
          }
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (Math.abs(dx) > link || Math.abs(dy) > link) {
            continue;
          }
          const dist = Math.hypot(dx, dy);
          if (dist > link) {
            continue;
          }
          const alpha = (1 - dist / link) * 0.16 * Math.min(a.z, b.z);
          ctx!.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx!.beginPath();
          ctx!.moveTo(a.x + parallaxX * a.z, a.y + parallaxY * a.z);
          ctx!.lineTo(b.x + parallaxX * b.z, b.y + parallaxY * b.z);
          ctx!.stroke();
        }
      }

      for (const burst of bursts) {
        const radius = 24 + burst.t * 280;
        ctx!.beginPath();
        ctx!.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(255,255,255,${(1 - burst.t) * 0.45})`;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }

      for (const dot of dots) {
        const twinkle = reduce ? 0.85 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame * 0.025 + dot.phase));
        let alpha = (0.15 + dot.z * 0.85) * twinkle;
        for (const burst of bursts) {
          const dist = Math.hypot(dot.x - burst.x, dot.y - burst.y);
          const radius = 24 + burst.t * 280;
          if (Math.abs(dist - radius) < 42) {
            alpha = Math.min(1, alpha + 0.85);
          }
        }
        const depth = 0.35 + dot.z * 0.9;
        const size = Math.max(0.6, dot.size * depth);
        const x = dot.x + parallaxX * dot.z;
        const y = dot.y + parallaxY * dot.z;
        if (size > 2.2) {
          ctx!.beginPath();
          ctx!.fillStyle = `rgba(255,255,255,${alpha * 0.16})`;
          ctx!.arc(x, y, size * 5, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx!.arc(x, y, size, 0, Math.PI * 2);
        ctx!.fill();
      }

      raf = window.requestAnimationFrame(step);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />;
}

export function SceneBackground({ theme, season }: { theme: "light" | "dark"; season: Season }) {
  if (theme === "dark") {
    return <ParticleField />;
  }
  return <SeasonField season={season} />;
}
