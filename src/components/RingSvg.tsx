const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RingSvgProps {
  /** Proporción 0-1 ya calculada por la API (`pct`): aquí solo se acota para dibujar. */
  pct: number;
  color?: string;
}

/** Anillo de IVA: descontable sobre generado. Mismas medidas que `ringSvg` del prototipo. */
export default function RingSvg({ pct, color = 'var(--terracota)' }: RingSvgProps) {
  const safe = Number.isFinite(pct) ? Math.min(1, Math.max(0, pct)) : 0;
  return (
    <svg
      width="110"
      height="110"
      viewBox="0 0 110 110"
      role="img"
      aria-label={`IVA descontable: ${Math.round(safe * 100)} % del generado`}
    >
      <circle cx="55" cy="55" r={RADIUS} fill="none" stroke="#EFEDE7" strokeWidth="10" />
      <circle
        data-testid="ring-progress"
        cx="55"
        cy="55"
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - safe)}
        transform="rotate(-90 55 55)"
      />
    </svg>
  );
}
