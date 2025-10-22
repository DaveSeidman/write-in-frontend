import React, { useEffect, useState, useRef } from "react";
import "./index.scss";

// --- point-in-polygon test ---
function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// --- relaxation physics (same as before) ---
function relaxPointsInPolygon(polygon, n, iterations = 400) {
  if (polygon.length < 3) return [];

  const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX, height = maxY - minY;
  const area = width * height;

  const randPoint = () => {
    let p;
    do {
      p = { x: minX + Math.random() * width, y: minY + Math.random() * height };
    } while (!pointInPolygon(p, polygon));
    return p;
  };

  const points = Array.from({ length: n }, randPoint);
  const idealDist = Math.sqrt(area / n) * 0.6;

  for (let step = 0; step < iterations; step++) {
    const forces = points.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) + 0.001;
        const force = (idealDist * idealDist) / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces[i].x -= fx;
        forces[i].y -= fy;
        forces[j].x += fx;
        forces[j].y += fy;
      }
    }

    for (let i = 0; i < n; i++) {
      points[i].x += forces[i].x * 0.01;
      points[i].y += forces[i].y * 0.01;
      if (!pointInPolygon(points[i], polygon)) {
        const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
        const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
        points[i].x += (cx - points[i].x) * 0.1;
        points[i].y += (cy - points[i].y) * 0.1;
      }
    }
  }
  return points;
}

export default function Layout() {
  const canvasRef = useRef(null);
  const [polygon, setPolygon] = useState([]);
  const [numPoints, setNumPoints] = useState(80);
  const [size, setSize] = useState(12);
  const [points, setPoints] = useState([]); // [{x,y,angle}]

  // click to add polygon vertices
  const handleCanvasClick = e => {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPolygon(prev => [...prev, { x, y }]);
  };

  // recompute points (and assign stable rotations) when polygon or count changes
  useEffect(() => {
    if (polygon.length >= 3) {
      const raw = relaxPointsInPolygon(polygon, numPoints, 400);
      // assign a stable random angle to each point (e.g., ±20°)
      const maxTilt = (20 * Math.PI) / 180;
      const withAngles = raw.map(p => ({
        ...p,
        angle: (Math.random() * 2 - 1) * maxTilt
      }));
      setPoints(withAngles);
    } else {
      setPoints([]);
    }
  }, [polygon, numPoints]);

  // draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // clear using actual canvas size
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // polygon
    if (polygon.length > 0) {
      ctx.beginPath();
      polygon.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (polygon.length >= 3) ctx.closePath();
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (polygon.length >= 3) {
        ctx.fillStyle = "rgba(0,188,212,0.1)";
        ctx.fill();
      }
      // vertices
      polygon.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#00bcd4";
        ctx.fill();
      });
    }

    // rotated squares centered on points (no jitter)
    const half = size / 2;
    ctx.fillStyle = "#ffca28";
    points.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      ctx.fillRect(-half, -half, size, size);
      ctx.restore();
    });
  }, [polygon, points, size]);

  return (
    <div className="layout" style={{ userSelect: "none" }}>
      <canvas
        width={1920}
        height={1080}
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ border: "1px solid #333", cursor: "crosshair" }}
      />
      <div className="controls">
        <label style={{ display: "block", marginTop: 8 }}>
          Points: {numPoints}
          <input
            type="range"
            min="1"
            max="200"
            value={numPoints}
            onChange={e => setNumPoints(parseInt(e.target.value))}
          />
        </label>
        <label style={{ display: "block", marginTop: 8 }}>
          Size: {size}
          <input
            type="range"
            min="2"
            max="60"
            value={size}
            onChange={e => setSize(parseInt(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
