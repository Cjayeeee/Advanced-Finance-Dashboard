/** Recharts bar shape: a thin pill stem capped with a dot, after the reference's bar style. */
export function Lollipop(props: { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: { future?: boolean }; stem?: number; muted?: boolean }) {
  const { x = 0, y = 0, width = 0, height = 0, fill = '#161615', payload } = props
  if (height <= 0 || !Number.isFinite(height)) {
    // zero value → faint baseline dot so empty days still read as days
    return <circle cx={x + width / 2} cy={y} r={2} fill={fill} opacity={0.18} />
  }
  const stem = Math.max(3, Math.min(props.stem ?? 7, width * 0.7))
  const cx = x + width / 2
  const r = Math.min(stem * 0.78, 5.5)
  const top = y
  return (
    <g opacity={payload?.future ? 0.3 : 1}>
      <rect x={cx - stem / 2} y={top} width={stem} height={Math.max(0, height - r * 2 - 3)} rx={stem / 2} fill={fill} />
      <circle cx={cx} cy={y + height - r} r={r} fill={fill} />
    </g>
  )
}

/** Rounded pill bar for denser views. */
export function PillBar(props: { x?: number; y?: number; width?: number; height?: number; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props
  if (height <= 0) return null
  const r = Math.min(width / 2, 10)
  return <rect x={x} y={y} width={width} height={height} rx={r} fill={fill} />
}
