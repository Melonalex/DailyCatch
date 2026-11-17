import { useEffect, useRef } from "react";

export type Season = "spring" | "summer" | "autumn" | "winter";

const COLORS: Record<Season, string[]> = {
  spring: ["#e98aa4", "#f4c3d0", "#fffdfd", "#b7d89a"],
  summer: ["#e2a322", "#f0c14a", "#fff1c2", "#ef8b3a"],
  autumn: ["#c4511a", "#e08a2c", "#c98612", "#8d3b24", "#e7b23a"],
  winter: ["#ffffff", "#f7fbff", "#d7e6f6"],
};

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  kind: number;
  life: number;
  burst: boolean;
};

export function seasonFor(now = new Date()): Season {
  const month = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "numeric" }).format(now),
  );
  if (month >= 3 && month <= 5) {
    return "spring";
  }
  if (month >= 6 && month <= 8) {
    return "summer";
  }
  if (month >= 9 && month <= 11) {
    return "autumn";
  }
  return "winter";
}

function colorFor(season: Season): string {
  const palette = COLORS[season];
  return palette[Math.floor(Math.random() * palette.length)];
}

function ambient(season: Season, width: number, height: number): Mote {
  const autumn = season === "autumn";
  const summer = season === "summer";
  const winter = season === "winter";
  const kind = winter
    ? Math.random() < 0.22
      ? 0
      : 1 + Math.floor(Math.random() * 2)
    : Math.floor(Math.random() * 3);
  const size = winter
    ? kind === 0
      ? 1.2 + Math.random() * 1.4
      : 10 + Math.random() * 6
    : summer
      ? 6 + Math.random() * 7
      : 5 + Math.random() * 8;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: autumn ? 0.55 + Math.random() * 1.15 : (Math.random() - 0.5) * (summer ? 0.28 : 0.4),
    vy: summer ? -(0.18 + Math.random() * 0.42) : 0.28 + Math.random() * (winter ? 0.9 : 0.75),
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * (winter ? 0.012 : autumn ? 0.05 : 0.02),
    size,
    color: colorFor(season),
    kind,
    life: 1,
    burst: false,
  };
}

function burstMote(season: Season, x: number, y: number): Mote {
  const angle = Math.random() * Math.PI * 2;
  const speed = 1.1 + Math.random() * 3.2;
  const winter = season === "winter";
  const summer = season === "summer";
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - (winter ? 0.6 : 0.2),
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.28,
    size: winter ? 8 + Math.random() * 6 : summer ? 6 + Math.random() * 5 : 6 + Math.random() * 8,
    color: colorFor(season),
    kind: winter ? 2 : Math.floor(Math.random() * 3),
    life: 1,
    burst: true,
  };
}

function drawPetal(ctx: CanvasRenderingContext2D, mote: Mote) {
  ctx.save();
  ctx.translate(mote.x, mote.y);
  ctx.rotate(mote.rot);
  ctx.fillStyle = mote.color;
  ctx.globalAlpha = mote.life;
  ctx.beginPath();
  ctx.ellipse(0, 0, mote.size * 0.42, mote.size * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, mote: Mote) {
  const size = mote.size;
  ctx.save();
  ctx.translate(mote.x, mote.y);
  ctx.rotate(mote.rot);
  ctx.fillStyle = mote.color;
  ctx.globalAlpha = mote.life;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.85, -size * 0.15, size * 0.55, size * 0.75, 0, size);
  ctx.bezierCurveTo(-size * 0.55, size * 0.75, -size * 0.85, -size * 0.15, 0, -size);
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 40, 12, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.7);
  ctx.lineTo(0, size * 0.75);
  ctx.stroke();
  ctx.restore();
}

function flakeSprite(variant: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.translate(32, 32);
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.4;
  ctx.shadowColor = "rgba(70, 100, 130, 0.55)";
  ctx.shadowBlur = 2;
  ctx.beginPath();
  for (let arm = 0; arm < 6; arm += 1) {
    const angle = (Math.PI / 3) * arm - Math.PI / 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 26, Math.sin(angle) * 26);
    const joints = variant === 0 ? [0.62] : [0.4, 0.68];
    for (const joint of joints) {
      const length = variant === 2 ? 8 : 11;
      const spread = variant === 2 ? 0.7 : 1;
      const x = Math.cos(angle) * 26 * joint;
      const y = Math.sin(angle) * 26 * joint;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle + spread) * length, y + Math.sin(angle + spread) * length);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle - spread) * length, y + Math.sin(angle - spread) * length);
    }
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

const FLAKES = [0, 1, 2].map((variant) => flakeSprite(variant));

function drawCrystal(ctx: CanvasRenderingContext2D, mote: Mote) {
  const sprite = FLAKES[mote.kind % FLAKES.length];
  const size = mote.size * 2;
  ctx.save();
  ctx.translate(mote.x, mote.y);
  ctx.rotate(mote.rot);
  ctx.globalAlpha = 0.95 * mote.life;
  ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawSummer(ctx: CanvasRenderingContext2D, mote: Mote) {
  ctx.save();
  ctx.translate(mote.x, mote.y);
  ctx.rotate(mote.rot);
  ctx.globalAlpha = mote.life;
  if (mote.kind === 0) {
    ctx.fillStyle = "#ffe08a";
    ctx.strokeStyle = "#e09000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, mote.size * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let ray = 0; ray < 8; ray += 1) {
      const angle = (Math.PI / 4) * ray;
      ctx.moveTo(Math.cos(angle) * mote.size * 0.5, Math.sin(angle) * mote.size * 0.5);
      ctx.lineTo(Math.cos(angle) * mote.size, Math.sin(angle) * mote.size);
    }
    ctx.stroke();
  } else if (mote.kind === 1) {
    ctx.fillStyle = "#fff7cf";
    ctx.strokeStyle = "#d97800";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let point = 0; point < 4; point += 1) {
      const angle = (Math.PI / 2) * point - Math.PI / 2;
      const tipX = Math.cos(angle) * mote.size;
      const tipY = Math.sin(angle) * mote.size;
      const side = angle + Math.PI / 4;
      if (point === 0) {
        ctx.moveTo(tipX, tipY);
      } else {
        ctx.lineTo(tipX, tipY);
      }
      ctx.lineTo(Math.cos(side) * mote.size * 0.22, Math.sin(side) * mote.size * 0.22);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#ef9b22";
    ctx.fillStyle = "#fff4c8";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(0, -mote.size * 0.35, mote.size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -mote.size * 0.12);
    ctx.quadraticCurveTo(mote.size * 0.45, mote.size * 0.15, 0, mote.size * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMote(ctx: CanvasRenderingContext2D, season: Season, mote: Mote) {
  if (season === "winter") {
    if (mote.kind === 0) {
      ctx.save();
      ctx.globalAlpha = 0.85 * mote.life;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    drawCrystal(ctx, mote);
    return;
  }
  if (season === "summer") {
    drawSummer(ctx, mote);
    return;
  }
  if (season === "spring") {
    drawPetal(ctx, mote);
    return;
  }
  drawLeaf(ctx, mote);
}

export function SeasonField({ season }: { season: Season }) {
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
    const motes: Mote[] = [];
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
      const density = season === "winter" ? 42000 : season === "summer" ? 52000 : 22000;
      const cap = season === "winter" ? 42 : season === "summer" ? 24 : 70;
      const count = Math.round(Math.min(cap, Math.max(16, (width * height) / density)));
      motes.length = 0;
      for (let index = 0; index < count; index += 1) {
        motes.push(ambient(season, width, height));
      }
    }

    function onDown(event: PointerEvent) {
      if (reduce) {
        return;
      }
      const count = season === "winter" ? 18 : 14;
      for (let index = 0; index < count; index += 1) {
        motes.push(burstMote(season, event.clientX, event.clientY));
      }
    }

    function step() {
      frame += 1;
      ctx!.clearRect(0, 0, width, height);
      const gust = season === "autumn" ? 0.75 + Math.sin(frame * 0.01) * 0.7 : 1;
      for (let index = motes.length - 1; index >= 0; index -= 1) {
        const mote = motes[index];
        if (!reduce) {
          const sway =
            season === "summer"
              ? Math.sin(frame * 0.012 + mote.rot) * 0.4
              : Math.sin(frame * 0.02 + mote.rot) * 0.45;
          mote.x += mote.vx * gust + sway;
          mote.y += mote.vy;
          mote.rot += mote.vr;
          if (mote.burst) {
            mote.vy += 0.035;
            mote.life -= 0.016;
          }
        }
        if (mote.life <= 0) {
          motes.splice(index, 1);
          continue;
        }
        if (!mote.burst) {
          if (mote.x < -30) {
            mote.x = width + 20;
          } else if (mote.x > width + 30) {
            mote.x = -20;
          }
          if (mote.y < -30) {
            mote.y = height + 20;
          } else if (mote.y > height + 30) {
            mote.y = -20;
          }
        }
        drawMote(ctx!, season, mote);
      }
      raf = window.requestAnimationFrame(step);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", onDown);
    raf = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [season]);

  return (
    <div className={`season-sky ${season}`} aria-hidden="true">
      <canvas ref={canvasRef} className="season-field" />
    </div>
  );
}
