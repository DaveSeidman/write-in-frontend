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
    : 'https://cocktail-generator-server.onrender.com/';

  const [submissions, setSubmissions] = useState([]);
  const latestSubmissions = useRef([]);
  const [positions, setPositions] = useState(projectorPositions);
  const [debug, setDebug] = useState(false);
  const { width, height } = useWindowSize();
  const [scale, setScale] = useState(1);

  const socketRef = useRef();
  const ageSubmissionsInterval = useRef();
  const removeSubmissionInterval = useRef();
  const addSubmissionInterval = useRef();

  // Keep ref in sync with state
  useEffect(() => {
    latestSubmissions.current = submissions;
  }, [submissions]);

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
      // TODO: this should somehow make sure any submissions that were removed are removed from the positions array
    });

    socket.on('submission-updated', (submission) => {
      if (!submission.approved) {
        setSubmissions(prev => prev.filter(s => s.timestamp !== submission.timestamp));
        setPositions(prev => prev.map(p =>
          p.submission?.timestamp === submission.timestamp
            ? { ...p, submission: null }
            : p
        ));
        return;
      }

      // 1. Update submissions list
      setSubmissions(prev => {
        const exists = prev.some(s => s.timestamp === submission.timestamp);
        return exists
          ? prev.map(s => s.timestamp === submission.timestamp ? submission : s)
          : [submission, ...prev];
      });

      // 2. Place the new submission
      setPositions(prev => {
        // First look for empty position
        const empty = prev.find(p => p.submission === null);
        if (empty) {
          return prev.map(p =>
            p.id === empty.id ? { ...p, age: 0, submission } : p
          );
        }

        // No empty positions, fall back to replacing the oldest
        const oldest = prev.reduce((max, curr) =>
          curr.age > max.age ? curr : max, prev[0]
        );

        return prev.map(p =>
          p.id === oldest.id ? { ...p, age: 0, submission } : p
        );
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!submissions.length) return;
    setPositions(prev =>
      prev.map(pos => {
        if (pos.submission === null) {
          const random = latestSubmissions.current[Math.floor(Math.random() * latestSubmissions.current.length)];
          return { ...pos, submission: random };
        }
        return pos;
      })
    );
  }, [submissions]);

  const ageSubmissions = () => {
    setPositions(prev => prev.map(pos => ({ ...pos, age: pos.age + 1 })));
  };

  const removeSubmission = () => {
    setPositions(prev => {
      const oldPositions = prev.filter(p => p.age > 3);
      if (!oldPositions.length) return prev;

      const randomId = oldPositions[Math.floor(Math.random() * oldPositions.length)].id;
      return prev.map(p =>
        p.id === randomId ? { ...p, age: 0, submission: null } : p
      );
    });
  };

  const addSubmission = () => {
    const subs = latestSubmissions.current;
    console.log({ subs })
    if (!subs.length) return;

    setPositions(prev => {
      const available = prev.filter(p => !p.submission);
      if (!available.length) return prev;

      const randomId = available[Math.floor(Math.random() * available.length)].id;
      const randomSub = subs[Math.floor(Math.random() * subs.length)];

      return prev.map(p =>
        p.id === randomId ? { ...p, age: 0, submission: randomSub } : p
      );
    });
  };

  const keyDown = ({ key }) => {
    if (key === 'F1') setDebug(prev => !prev);
  };

  useEffect(() => {
    ageSubmissionsInterval.current = setTimeout(() => { setInterval(ageSubmissions, 1500); }, 0)
    removeSubmissionInterval.current = setTimeout(() => { setInterval(removeSubmission, 1500); }, 500);
    addSubmissionInterval.current = setTimeout(() => { setInterval(addSubmission, 1500); }, 1000);
    addEventListener('keydown', keyDown);

    return () => {
      clearInterval(ageSubmissionsInterval.current);
      clearInterval(removeSubmissionInterval.current);
      clearInterval(addSubmissionInterval.current);
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

    ctx.fillStyle = 'brown';
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
    const animationStart = performance.now();
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const animate = () => {
      const now = performance.now();
      const elapsed = now - animationStart;

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

  return <canvas ref={canvasRef} width={800} height={400} className={`preview-canvas ${id}`} />;
};

export default Results;
