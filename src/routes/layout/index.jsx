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

// --- sample a random point guaranteed inside polygon bounding box ---
function randomPointInsidePolygon(polygon) {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  let pt;
  let attempts = 0;
  do {
    pt = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY)
    };
    attempts++;
  } while (!pointInPolygon(pt, polygon) && attempts < 500);
  return pt;
}

// --- create stationary wall points along polygon edges ---
function getWallPoints(polygon, spacing = 6) {
  const wallPoints = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(len / spacing);
    for (let s = 0; s <= steps; s++) {
      wallPoints.push({
        x: a.x + (dx * s) / steps,
        y: a.y + (dy * s) / steps
      });
    }
  }
  return wallPoints;
}

export default function Layout() {
  const canvasRef = useRef(null);
  const [polygon, setPolygon] = useState([]);
  const [numPoints, setNumPoints] = useState(80);
  const [size, setSize] = useState(10);
  const [points, setPoints] = useState([]);
  const [walls, setWalls] = useState([]);

  const handleCanvasClick = e => {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPolygon(prev => [...prev, { x, y }]);
  };

  // spawn particles INSIDE the polygon safely
  useEffect(() => {
    if (polygon.length < 3) return;
    const pts = Array.from({ length: numPoints }, () => {
      const p = randomPointInsidePolygon(polygon);
      return {
        ...p,
        vx: 0,
        vy: 0,
        sleepCount: 0,
        asleep: false,
        angle: Math.random() * Math.PI * 2
      };
    });
    setPoints(pts);
    setWalls(getWallPoints(polygon, 6));
  }, [polygon, numPoints]);

  // main simulation loop
  useEffect(() => {
    if (polygon.length < 3 || points.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const maxSpeed = 3;
    const damping = 0.9;
    const repulsionStrength = 1000;
    const wallStrengthBase = 4000; // much stronger than before
    const wallInfluenceDist = 60;
    const sleepThreshold = 0.02;
    const sleepFrames = 10;

    let frame;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const next = points.map(p => ({ ...p }));

      for (let i = 0; i < next.length; i++) {
        const pi = next[i];
        if (pi.asleep) continue;

        let fx = 0,
          fy = 0;

        // inter-particle repulsion
        for (let j = 0; j < next.length; j++) {
          if (i === j) continue;
          const pj = next[j];
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const distSq = dx * dx + dy * dy + 0.01;
          const dist = Math.sqrt(distSq);
          const force = repulsionStrength / distSq;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }

        // wall repulsion (adaptive)
        for (const w of walls) {
          const dx = pi.x - w.x;
          const dy = pi.y - w.y;
          const distSq = dx * dx + dy * dy + 0.01;
          const dist = Math.sqrt(distSq);
          if (dist < wallInfluenceDist) {
            // stronger closer to wall
            const strength =
              wallStrengthBase * (1 - dist / wallInfluenceDist);
            fx += (dx / dist) * strength / distSq;
            fy += (dy / dist) * strength / distSq;
          }
        }

        // integrate motion
        pi.vx = (pi.vx + fx * 0.01) * damping;
        pi.vy = (pi.vy + fy * 0.01) * damping;

        const speed = Math.sqrt(pi.vx * pi.vx + pi.vy * pi.vy);
        if (speed > maxSpeed) {
          pi.vx *= maxSpeed / speed;
          pi.vy *= maxSpeed / speed;
        }

        pi.x += pi.vx;
        pi.y += pi.vy;

        // if escaped (failsafe), snap gently back inside
        if (!pointInPolygon(pi, polygon)) {
          const safe = randomPointInsidePolygon(polygon);
          pi.x = safe.x;
          pi.y = safe.y;
          pi.vx *= 0.2;
          pi.vy *= 0.2;
        }

        // sleep logic
        if (speed < sleepThreshold) pi.sleepCount++;
        else pi.sleepCount = 0;
        if (pi.sleepCount > sleepFrames) pi.asleep = true;
      }

      for (let i = 0; i < points.length; i++) points[i] = next[i];

      // draw polygon
      ctx.beginPath();
      polygon.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(0,188,212,0.05)";
      ctx.fill();

      // draw squares
      const half = size / 2;
      for (const p of points) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.asleep ? "#ffca28" : "#00c853";
        ctx.fillRect(-half, -half, size, size);
        ctx.restore();
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [polygon, points, size, walls]);

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
            max="500"
            value={numPoints}
            onChange={e => setNumPoints(parseInt(e.target.value))}
          />
        </label>
        <label style={{ display: "block", marginTop: 8 }}>
          Size: {size}
          <input
            type="range"
            min="2"
            max="50"
            value={size}
            onChange={e => setSize(parseInt(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
