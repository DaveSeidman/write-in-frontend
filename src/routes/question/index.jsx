import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils";
import { io } from "socket.io-client";

import './index.scss';

const Question = () => {
  const canvasRef = useRef();
  const [strokes, setStrokes] = useState([]); // array of arrays
  const [isDrawing, setDrawing] = useState(false);
  const socketRef = useRef();

  const width = 800;
  const height = 400;

  const handlePointerDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now(),
      pressure: e.pressure || 0.5,
    };

    setStrokes(prev => [...prev, [p]]);
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

    setStrokes(prev => {
      const newStrokes = [...prev];
      newStrokes[newStrokes.length - 1] = [...newStrokes[newStrokes.length - 1], p];
      drawPoints(newStrokes);
      return newStrokes;
    });
  };

  const handlePointerUp = () => setDrawing(false);

  const drawPoints = (strokesArray, clear = true) => {
    const ctx = canvasRef.current.getContext('2d');
    if (clear) ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'black';

    strokesArray.forEach(stroke => {
      const input = stroke.map(p => [p.x, p.y, p.pressure]);
      const outline = getStroke(input);
      const path = new Path2D(ptsToSvgPath(outline));
      ctx.fill(path);
    });
  };

  const replay = () => {
    if (!strokes.length) return;

    const flatPoints = strokes.flat();
    const startTime = flatPoints[0].t;
    let i = 1;

    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;

      let tempStrokes = [[]];
      for (let s = 0; s < strokes.length; s++) {
        tempStrokes[s] = [];
        for (let j = 0; j < strokes[s].length; j++) {
          const pt = strokes[s][j];
          if (pt.t - startTime <= elapsed) {
            tempStrokes[s].push(pt);
          }
        }
      }

      drawPoints(tempStrokes);

      if (flatPoints[i] && flatPoints[i].t - startTime <= elapsed) {
        i++;
      }

      if (i < flatPoints.length) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  const reset = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    setStrokes([]);
  };

  const submit = () => {
    if (!strokes.length) return;
    socketRef.current.emit('submit', strokes);
    reset();
  };

  useEffect(() => {
    const isLocalhost = window.location.hostname !== 'daveseidman.github.io';
    const URL = isLocalhost
      ? `http://${location.hostname}:8000`
      : 'https://cocktail-generator-server.onrender.com/';

    const socket = io(URL, {
      transports: ['websocket'],
      query: { role: 'question' }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server:', socket.id);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="question">
      <h1>Which Brand do you think this event is for?</h1>
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
        <button onClick={replay} disabled={!strokes.length}>Replay</button>
        <button onClick={reset} disabled={!strokes.length}>Reset</button>
        <button onClick={submit} disabled={!strokes.length}>Submit</button>
      </div>
    </div>
  );
};

export default Question;
