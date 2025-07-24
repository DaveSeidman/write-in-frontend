// Helper to convert outline points to SVG path
export const ptsToSvgPath = (points) => {
  if (!points.length) return '';
  const d = points.reduce((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    return acc;
  }, ['M', points[0][0], points[0][1], 'Q']);
  d.push('Z');
  return d.join(' ');
}