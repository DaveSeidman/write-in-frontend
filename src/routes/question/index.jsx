import React, { useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import './index.scss';

const Question = () => {
  const canvasRef = useRef();
  const [points, setPoints] = useState([]);
  const [isDrawing, setDrawing] = useState(false);

  const width = 500;
  const height = 200;

  const handlePointerDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now(),
      pressure: e.pressure || 0.5,
    };
    setPoints([p]);
    setDrawing(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const p = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now(),
      pressure: e.pressure || 0.5,
    };
    const newPoints = [...points, p];
    setPoints(newPoints);
    drawPoints(newPoints);
  };

  const handlePointerUp = () => setDrawing(false);

  const drawPoints = (pts, clear = true) => {
    const ctx = canvasRef.current.getContext('2d');
    if (clear) ctx.clearRect(0, 0, width, height);

    const strokeInput = pts.map(p => [p.x, p.y, p.pressure]);
    const outline = getStroke(strokeInput);
    const path = new Path2D(ptsToSvgPath(outline));
    ctx.fillStyle = 'black';
    ctx.fill(path);
  };

  const replay = () => {
    if (!points.length) return;

    const startTime = points[0].t;
    let i = 1;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;

      // Advance only if the next point's time has arrived
      if (i < points.length && points[i].t - startTime <= elapsed) {
        i++;
        drawPoints(points.slice(0, i));
      }

      if (i < points.length) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };


  return (
    <div className="question">
      <h1>Question</h1>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="signature-canvas"
        style={{ border: '1px solid #ccc', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="buttons">
        <button onClick={replay}>Replay</button>
      </div>
    </div>
  );
};

export default Question;

// Helper to convert outline points to SVG path
function ptsToSvgPath(points) {
  if (!points.length) return '';
  const d = points.reduce((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    return acc;
  }, ['M', points[0][0], points[0][1], 'Q']);
  d.push('Z');
  return d.join(' ');
}
