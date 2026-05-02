export function SkeletonBlock({ width = '100%', height = '1rem', style }) {
  return (
    <div
      className="shimmer"
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}
