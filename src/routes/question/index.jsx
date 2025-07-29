import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { useWindowSize } from 'react-use';
import { ptsToSvgPath } from "../../utils";
import { io } from "socket.io-client";
import backgroundVideo from '../../assets/videos/background1.mp4'

import './index.scss';

const Question = () => {
  const canvasRef = useRef();
  const t0Ref = useRef(null); // reference time
  const [strokes, setStrokes] = useState([]); // array of arrays
  const [isDrawing, setDrawing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const videoRef = useRef();
  const socketRef = useRef();

  const { width, height } = useWindowSize();
  const titleHeight = 122;
  // const width = 800;
  // const height = 400;

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
    if (clear) ctx.clearRect(0, 0, width, height - titleHeight);

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
    ctx.clearRect(0, 0, width, height - titleHeight);
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
      <div className="question-background">
        <video ref={videoRef} src={backgroundVideo} autoplay loop muted />
      </div>
      <div className="question-title">
        <h2>Take your guess:</h2>
        <h1>What breakthrough product will be revealed?</h1>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height - titleHeight}
        className="question-canvas"
        // style={{ border: '1px solid #ccc', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="question-controls">
        <button className="question-controls-reset" onClick={reset} disabled={!strokes.length}></button>
        <button className="question-controls-submit" onClick={submit} disabled={!strokes.length}></button>
      </div>
      <div className={`question-submitted ${submitted ? '' : 'hidden'}`}>
        <h1>Thank you for submitting your guess!</h1>
      </div>
      <p className="question-disclaimer">product name only please, no brand guesses!</p>


      {!fullscreen && (<button
        type="button"
        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        onClick={() => {
          document.documentElement.webkitRequestFullScreen();
          setFullscreen(true);
          videoRef.current.play();
        }}
      >
        Touch To Begin
      </button>)}
    </div>
  );
};

export default Question;
