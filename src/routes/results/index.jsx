import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils"; // adjust if needed
import { io } from "socket.io-client";

import './index.scss';

const Results = () => {
  const isLocalhost = window.location.hostname !== 'daveseidman.github.io';
  const URL = isLocalhost
    ? `http://${location.hostname}:8000`
    : 'https://cocktail-generator-server.onrender.com/';

  const [submissions, setSubmissions] = useState([]);
  const socketRef = useRef();

  useEffect(() => {
    const socket = io(URL, {
      transports: ['websocket'],
      query: { role: 'results' }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to socket server (results):', socket.id);
    });

    socket.on('approvedsubmissions', (data) => {
      console.log('📦 Approved submissions on boot:', data);
      setSubmissions(data.sort((a, b) => b.timestamp - a.timestamp));
    });

    socket.on('submission-updated', (submission) => {
      if (!submission.approved) return;

      setSubmissions(prev => {
        const alreadyExists = prev.some(s => s.timestamp === submission.timestamp);
        if (alreadyExists) {
          return prev.map(s => s.timestamp === submission.timestamp ? submission : s);
        }
        return [submission, ...prev];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="results">
      <h1>Results</h1>
      <div className="submission-list">
        {submissions.map((submission) => (
          <CanvasPreview key={submission.timestamp} points={submission.data} />
        ))}
      </div>
    </div>
  );
};

const CanvasPreview = ({ points }) => {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points || !Array.isArray(points)) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';

    points.forEach(strokePoints => {
      if (!Array.isArray(strokePoints) || strokePoints.length === 0) return;

      const stroke = getStroke(strokePoints.map(p => [p.x, p.y, p.pressure]));
      const path = new Path2D(ptsToSvgPath(stroke));
      ctx.fill(path);
    });
  }, [points]);

  return <canvas ref={canvasRef} width={800} height={400} className="preview-canvas" />;
};


export default Results;
