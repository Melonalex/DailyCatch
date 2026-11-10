import { useEffect, useState } from "react";

type Bit = { dx: number; dy: number; kind: number };
type Burst = { id: number; x: number; y: number; bits: Bit[] };

export function ClickFx() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    function onDown(event: PointerEvent) {
      const bits = Array.from({ length: 16 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 16 + Math.random() * 0.5;
        const distance = 22 + Math.random() * 42;
        return {
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - 8,
          kind: index % 3,
        };
      });
      const id = Date.now() + Math.random();
      setBursts((current) => [...current.slice(-8), { id, x: event.clientX, y: event.clientY, bits }]);
      window.setTimeout(() => {
        setBursts((current) => current.filter((item) => item.id !== id));
      }, 700);
    }
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <div className="fx-layer" aria-hidden="true">
      {bursts.map((burst) => (
        <span key={burst.id} className="fx-origin" style={{ left: burst.x, top: burst.y }}>
          {burst.bits.map((bit, index) => (
            <i
              key={index}
              className={`spark kind-${bit.kind}`}
              style={{ ["--dx" as string]: `${bit.dx}px`, ["--dy" as string]: `${bit.dy}px` }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}
