const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function releaseDecision(p, now = performance.now()) {
  const from = p.progress ?? p.start;
  const velocity = now - (p.lastMoveTime ?? 0) < 120 ? (p.velocity ?? 0) : 0;
  const projected = clamp(from + clamp(velocity * 0.14, -0.24, 0.24), 0, 1);
  const commit =
    !p.cancelled && (!p.moved || (p.direction > 0 ? projected > 0.3 : projected < 0.7));
  const target = commit ? (p.direction > 0 ? 1 : 0) : p.start;
  const duration = clamp(
    (620 * Math.abs(target - from)) / (1 + Math.abs(velocity) * 0.3),
    220,
    680,
  );
  return { from, commit, target, duration, velocity };
}
export function turnProgress(from, to, t, velocity = 0, duration = 900) {
  t = clamp(t, 0, 1);
  const delta = to - from;
  const tangent =
    Math.sign(delta) *
    clamp((Math.sign(delta) * velocity * duration) / 1000, 0, Math.abs(delta) * 2);
  return (
    (2 * t * t * t - 3 * t * t + 1) * from +
    (t * t * t - 2 * t * t + t) * tangent +
    (-2 * t * t * t + 3 * t * t) * to
  );
}
