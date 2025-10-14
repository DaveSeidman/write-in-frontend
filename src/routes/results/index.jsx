import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils";
import { useWindowSize } from 'react-use';
import { io } from "socket.io-client";
import projectorPositions from '../../assets/data/projector-positions.json';

import './index.scss';

const Results = () => {
  const isLocalhost = window.location.hostname !== 'daveseidman.github.io';
  const URL = isLocalhost
    ? `http://${location.hostname}:8000`
    : 'https://write-in-backend.onrender.com/';

  const [submissions, setSubmissions] = useState([]);
  const submissionsRef = useRef([]);

  const [positions, setPositions] = useState(projectorPositions);
  const positionsRef = useRef([]);

  const [debug, setDebug] = useState(false);
  const { width, height } = useWindowSize();
  const [scale, setScale] = useState(1);
  const timeouts = useRef([]);
  const intervals = useRef([]);

  const socketRef = useRef();

  // Keep ref in sync with state
  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])


  const addSubmissionToPosition = () => {
    const availablePositions = positionsRef.current.filter(p => !p.submission);
    if (!availablePositions.length || !submissionsRef.current.length) return;
    const randomPositionId = availablePositions[Math.floor(Math.random() * availablePositions.length)].id;
    const unusedSubmissions = submissionsRef.current.filter(s => !positionsRef.current.some(p => p.submission?.timestamp === s.timestamp));
    const randomSubmission = unusedSubmissions[Math.floor(Math.random() * unusedSubmissions.length)];

    if (!randomSubmission) {
      console.log('no submissions left to place');
      // TODO: we could stop the interval here but we're going ot switch to setTimeout's anyway
      return;
    }
    console.log(`there are ${availablePositions.length} available positions, assigning: ${randomSubmission.timestamp} to position: ${randomPositionId}`)
    setPositions(prev => prev.map(p => p.id === randomPositionId ? { ...p, submission: randomSubmission } : p));
  }

  useEffect(() => {
    const socket = io(URL, {
      transports: ['websocket'],
      query: { role: 'results' }
    });

    socketRef.current = socket;

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to socket server (results):', socket.id);
    });

    socketRef.current.on('allsubmissions', (data) => {
      const approvedSubmissions = data.filter(s => s.approved)
      console.log('📦 Approved submissions on boot:', approvedSubmissions);
      setSubmissions(approvedSubmissions);
    });

    socketRef.current.on('submission-updated', (submission) => {
      // remove submission
      console.log('update', submission);
      if (!submission.approved) {
        setSubmissions(prev => prev.filter(s => s.timestamp !== submission.timestamp))
        console.log('if this submission in a position, remove it', submission.timestamp)
        setPositions(prev => prev.map(p => p.submission?.timestamp === submission.timestamp ? { ...p, submission: null } : p))
      } else {
        setSubmissions(prev => [...prev, submission]);
      }
    });

    socketRef.current.on('clear', () => {
      setPositions(projectorPositions)
      intervals.current.forEach(i => clearInterval(i))
    })

    socketRef.current.on('start', () => {
      console.log('submissions:', submissions)
      intervals.current.forEach(i => clearInterval(i));
      setPositions(projectorPositions)
      intervals.current.push(setInterval(addSubmissionToPosition, 500));
    })

    return () => {
      timeouts.current.forEach(t => clearTimeout(t));
      intervals.current.forEach(i => clearInterval(i));
      socketRef.current.disconnect();
    }
  }, []);

  const keyDown = ({ key }) => {
    if (key === 'F1') setDebug(prev => !prev);
  };

  useEffect(() => {
    addEventListener('keydown', keyDown);

    return () => {
      removeEventListener('keydown', keyDown);
    };
  }, []);

  useEffect(() => {
    const projectorWidth = 3840;
    const projectorHeight = 2160;
    const aspectRatio = projectorWidth / projectorHeight;
    const windowRatio = width / height;
    const newScale = windowRatio < aspectRatio
      ? width / projectorWidth
      : height / projectorHeight;
    setScale(newScale);
  }, [width, height]);

  return (
    <div className={`results ${debug ? 'debug' : ''}`} style={{ transform: `scale(${scale})` }}>
      <div className="results-positions2">
        {positions.map(position => (
          <span
            key={position.id}
            className="results-positions2-submission"
            style={{
              top: `${position.y * 100}%`,
              left: `${position.x * 100}%`,
            }}
          >
            {position.submission ? (
              <CanvasPreview
                key={position.submission.timestamp}
                strokes={position.submission.data}
                id={position.submission.timestamp}
              />
            ) : (
              <span className="empty" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

const CanvasPreview = ({ strokes, id }) => {
  const canvasRef = useRef();
  const width = 800;
  const height = 400;

  const drawPoints = (strokesArray, clear = true) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    if (clear) ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgb(63,13,26)';
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
    let i = 1;
    const speed = 2;
    const animationStart = performance.now();
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const animate = () => {
      const now = performance.now();
      const elapsed = (now - animationStart) * speed;

      const tempStrokes = strokes.map(() => []);
      for (let s = 0; s < strokes.length; s++) {
        for (let j = 0; j < strokes[s].length; j++) {
          const pt = strokes[s][j];
          if (pt.t <= elapsed) {
            tempStrokes[s].push(pt);
          }
        }
      }

      drawPoints(tempStrokes);

      if (flatPoints[i] && flatPoints[i].t <= elapsed) i++;
      if (i < flatPoints.length) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  useEffect(() => {
    replay();
  }, []);

  return <canvas ref={canvasRef} width={1200} height={800 - 120} className={`preview-canvas ${id}`} />;
};

export default Results;
