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
  const snowRoll = Math.random();
  const size = winter
    ? snowRoll < 0.5
      ? 1 + Math.random() * 1.1
      : snowRoll < 0.82
        ? 2.2 + Math.random() * 1.4
        : 4 + Math.random() * 2.2
    : summer
      ? 6 + Math.random() * 7
      : 5 + Math.random() * 8;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: autumn ? 0.55 + Math.random() * 1.15 : (Math.random() - 0.5) * (summer ? 0.28 : 0.4),
    vy: summer ? -(0.18 + Math.random() * 0.42) : winter ? 0.18 + size * 0.28 : 0.28 + Math.random() * 0.75,
    rot: Math.random() * Math.PI * 2,
    vr: winter ? 0 : (Math.random() - 0.5) * (autumn ? 0.05 : 0.02),
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
    vr: (Math.random() - 0.5) * (winter ? 0.03 : 0.28),
    size: winter ? 48 + Math.random() * 24 : summer ? 6 + Math.random() * 5 : 6 + Math.random() * 8,
    color: colorFor(season),
    kind: Math.floor(Math.random() * (winter ? FLAKES.length : 3)),
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

function snowSprite(radius: number): HTMLCanvasElement {
  const pad = Math.ceil(radius * 2.2);
  const size = (radius + pad) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, radius * 0.15, center, center, radius + pad * 0.45);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.95)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, radius + pad * 0.45, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

const SNOW = [1.4, 3, 5.4].map((radius) => snowSprite(radius));

type FlakeStyle = {
  branches: number[];
  branchScale: number;
  twigs: boolean;
  tip: "point" | "diamond" | "fork";
  center: number;
};

const FLAKE_STYLES: FlakeStyle[] = [
  { branches: [0.34, 0.52, 0.7, 0.86], branchScale: 0.36, twigs: true, tip: "diamond", center: 8 },
  { branches: [0.4, 0.62, 0.82], branchScale: 0.46, twigs: false, tip: "fork", center: 11 },
  { branches: [0.28, 0.44, 0.6, 0.76], branchScale: 0.3, twigs: true, tip: "point", center: 6 },
  { branches: [0.46, 0.68], branchScale: 0.52, twigs: true, tip: "diamond", center: 13 },
];

function traceBranch(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, reach: number, twigs: boolean) {
  const x2 = x + Math.sin(angle) * reach;
  const y2 = y - Math.cos(angle) * reach;
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  if (!twigs) {
    return;
  }
  const midX = x + Math.sin(angle) * reach * 0.55;
  const midY = y - Math.cos(angle) * reach * 0.55;
  const twig = reach * 0.42;
  ctx.moveTo(midX, midY);
  ctx.lineTo(midX + Math.sin(angle + 0.75) * twig, midY - Math.cos(angle + 0.75) * twig);
  ctx.moveTo(midX, midY);
  ctx.lineTo(midX + Math.sin(angle - 0.55) * twig * 0.65, midY - Math.cos(angle - 0.55) * twig * 0.65);
}

function traceArm(ctx: CanvasRenderingContext2D, length: number, style: FlakeStyle) {
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -length);
  for (const place of style.branches) {
    const y = -length * place;
    const reach = length * style.branchScale * (1.15 - place);
    traceBranch(ctx, 0, y, Math.PI / 3, reach, style.twigs);
    traceBranch(ctx, 0, y, -Math.PI / 3, reach, style.twigs);
  }
  if (style.tip === "diamond") {
    ctx.moveTo(0, -length + 8);
    ctx.lineTo(6, -length);
    ctx.lineTo(0, -length - 9);
    ctx.lineTo(-6, -length);
    ctx.closePath();
    return;
  }
  if (style.tip === "fork") {
    ctx.moveTo(0, -length * 0.88);
    ctx.lineTo(8, -length - 3);
    ctx.moveTo(0, -length * 0.88);
    ctx.lineTo(-8, -length - 3);
    ctx.moveTo(0, -length * 0.88);
    ctx.lineTo(0, -length - 7);
  }
}

function flakeSprite(style: FlakeStyle): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const strokeArms = () => {
    ctx.beginPath();
    for (let arm = 0; arm < 6; arm += 1) {
      ctx.save();
      ctx.translate(90, 90);
      ctx.rotate((Math.PI / 3) * arm);
      traceArm(ctx, 68, style);
      ctx.restore();
    }
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(190, 216, 242, 0.85)";
  ctx.lineWidth = 3.4;
  strokeArms();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.96)";
  ctx.lineWidth = 1.8;
  strokeArms();
  ctx.stroke();
  ctx.beginPath();
  for (let point = 0; point < 6; point += 1) {
    const angle = (Math.PI / 3) * point - Math.PI / 2;
    const x = 90 + Math.cos(angle) * style.center;
    const y = 90 + Math.sin(angle) * style.center;
    if (point === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fill();
  ctx.stroke();
  return canvas;
}

const FLAKES = FLAKE_STYLES.map((style) => flakeSprite(style));

function drawFlake(ctx: CanvasRenderingContext2D, mote: Mote) {
  const sprite = FLAKES[mote.kind % FLAKES.length];
  const drawSize = mote.size * 2.1;
  ctx.save();
  ctx.translate(mote.x, mote.y);
  ctx.rotate(mote.rot);
  ctx.globalAlpha = 0.92 * mote.life;
  ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
  ctx.restore();
}

function drawSnow(ctx: CanvasRenderingContext2D, mote: Mote) {
  const sprite = mote.size < 1.8 ? SNOW[0] : mote.size < 3.2 ? SNOW[1] : SNOW[2];
  const drawSize = mote.size * 5;
  ctx.save();
  ctx.globalAlpha = mote.life * (mote.size < 2.1 ? 0.84 : mote.size < 3.6 ? 0.94 : 1);
  ctx.drawImage(sprite, mote.x - drawSize / 2, mote.y - drawSize / 2, drawSize, drawSize);
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
    if (mote.burst) {
      drawFlake(ctx, mote);
      return;
    }
    drawSnow(ctx, mote);
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
  const burstRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const burstCanvas = burstRef.current;
    if (!canvas || !burstCanvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    const burstCtx = burstCanvas.getContext("2d");
    if (!ctx || !burstCtx) {
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
      burstCanvas!.width = canvas!.width;
      burstCanvas!.height = canvas!.height;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      burstCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const density = season === "winter" ? 12500 : season === "summer" ? 52000 : 22000;
      const cap = season === "winter" ? 120 : season === "summer" ? 24 : 70;
      const count = Math.round(Math.min(cap, Math.max(season === "winter" ? 40 : 16, (width * height) / density)));
      motes.length = 0;
      for (let index = 0; index < count; index += 1) {
        motes.push(ambient(season, width, height));
      }
    }

    function onDown(event: PointerEvent) {
      if (reduce) {
        return;
      }
      const count = season === "winter" ? 8 : 14;
      for (let index = 0; index < count; index += 1) {
        motes.push(burstMote(season, event.clientX, event.clientY));
      }
    }

    function step() {
      frame += 1;
      ctx!.clearRect(0, 0, width, height);
      burstCtx!.clearRect(0, 0, width, height);
      const gust = season === "autumn" ? 0.75 + Math.sin(frame * 0.01) * 0.7 : 1;
      for (let index = motes.length - 1; index >= 0; index -= 1) {
        const mote = motes[index];
        if (!reduce) {
          if (mote.burst) {
            mote.x += mote.vx;
            mote.y += mote.vy;
            mote.vy += season === "winter" ? 0.016 : 0.035;
            mote.rot += mote.vr;
            mote.life -= season === "winter" ? 0.01 : 0.016;
          } else {
            const sway =
              season === "winter"
                ? Math.sin(frame * 0.007 + mote.rot) * (0.12 + mote.size * 0.09)
                : season === "summer"
                  ? Math.sin(frame * 0.012 + mote.rot) * 0.4
                  : Math.sin(frame * 0.02 + mote.rot) * 0.45;
            const wind = season === "winter" ? Math.sin(frame * 0.003) * 0.28 : 0;
            mote.x += mote.vx * gust + sway + wind;
            mote.y += mote.vy;
            mote.rot += mote.vr;
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
        if (mote.burst && season === "winter") {
          drawFlake(burstCtx!, mote);
        } else {
          drawMote(ctx!, season, mote);
        }
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
    <>
      <div className={`season-sky ${season}`} aria-hidden="true">
        <canvas ref={canvasRef} className="season-field" />
      </div>
      <canvas ref={burstRef} className="season-burst" aria-hidden="true" />
    </>
  );
}
