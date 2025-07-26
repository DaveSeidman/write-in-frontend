import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils";
import { io } from "socket.io-client";

import './index.scss';

const Question = () => {
  const canvasRef = useRef();
  const t0Ref = useRef(null); // reference time
  const [strokes, setStrokes] = useState([]); // array of arrays
  const [isDrawing, setDrawing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const socketRef = useRef();

  const width = 800;
  const height = 400;

  const handlePointerDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const now = performance.now();

    if (t0Ref.current === null) {
      t0Ref.current = now; // set t0 at the first touch
    }

    const p = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: now - t0Ref.current,
      pressure: e.pressure || 0.5,
    };

    setStrokes(prev => [...prev, [p]]);
    setDrawing(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const now = performance.now();

    const p = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: now - t0Ref.current,
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

  const reset = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    setStrokes([]);
    t0Ref.current = null;
  };

  const submit = () => {
    if (!strokes.length) return;
    socketRef.current.emit('submit', strokes);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
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
      <h2>Take your guess:</h2>
      <h1>What breakthrough product will be revealed?</h1>
      <p>product name only please, no brand guesses!!</p>
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
        <button onClick={reset} disabled={!strokes.length}>Reset</button>
        <button onClick={submit} disabled={!strokes.length}>Submit</button>
      </div>
      <div className={`thanks ${submitted ? '' : 'hidden'}`}>
        <h1>Your Guess has been Submitted, Thanks!</h1>
      </div>
    </div>
  );
};

export default Question;
