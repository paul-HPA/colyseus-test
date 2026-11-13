export function smoothPosition(position, target, elapsedSeconds) {
  const blend = 1 - Math.exp(-elapsedSeconds / 0.075);
  return position.lerp(target, blend);
}
