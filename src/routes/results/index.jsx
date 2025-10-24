import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils";
import { useWindowSize } from 'react-use';
import { io } from "socket.io-client";
// Import pre-computed positions from Python script (150 positions with normalized x/y coords)
import projectorPositions from '../../assets/data/projector-positions.json';
// Central configuration for projector dimensions
import { PROJECTOR_CONFIG } from '../../config';

import './index.scss';

const Results = () => {
  // Determine backend URL based on environment
  const isLocalhost = window.location.hostname !== 'daveseidman.github.io';
  const URL = isLocalhost
    ? `http://${location.hostname}:8000`
    : 'https://write-in-backend.onrender.com/';

  // Approved submissions from backend (drawings that can be displayed)
  const [submissions, setSubmissions] = useState([]);
  const submissionsRef = useRef([]);

  // Position grid where submissions will be placed (each position can hold one submission)
  const [positions, setPositions] = useState(projectorPositions);
  const positionsRef = useRef([]);

  // Debug mode toggles visual indicators (F1 key)
  const [debug, setDebug] = useState(false);
  // Window dimensions for responsive scaling
  const { width, height } = useWindowSize();
  // Scale factor to fit 3840×2160 projector canvas to actual window size
  const [scale, setScale] = useState(1);
  // Cleanup references for timers
  const timeouts = useRef([]);
  const intervals = useRef([]);

  // Socket.io connection to backend
  const socketRef = useRef();

  // Keep refs in sync with state for use in intervals/callbacks
  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  /**
   * Randomly assigns an unused submission to an available position
   * Called by interval when "start" event is received from admin
   */
  const addSubmissionToPosition = () => {
    // Find positions that don't have a submission yet
    const availablePositions = positionsRef.current.filter(p => !p.submission);
    if (!availablePositions.length || !submissionsRef.current.length) return;

    // Pick random empty position
    const randomPositionId = availablePositions[Math.floor(Math.random() * availablePositions.length)].id;

    // Find submissions that haven't been placed yet
    const unusedSubmissions = submissionsRef.current.filter(s => !positionsRef.current.some(p => p.submission?.timestamp === s.timestamp));
    const randomSubmission = unusedSubmissions[Math.floor(Math.random() * unusedSubmissions.length)];

    if (!randomSubmission) {
      console.log('no submissions left to place');
      // TODO: we could stop the interval here but we're going to switch to setTimeout's anyway
      return;
    }

    console.log(`there are ${availablePositions.length} available positions, assigning: ${randomSubmission.timestamp} to position: ${randomPositionId}`)
    // Update the position to include the submission
    setPositions(prev => prev.map(p => p.id === randomPositionId ? { ...p, submission: randomSubmission } : p));
  }

  // Setup socket connection and event handlers
  useEffect(() => {
    const socket = io(URL, {
      transports: ['websocket'],
      query: { role: 'results' } // Identify as results display client
    });

    socketRef.current = socket;

    // Connection established
    socketRef.current.on('connect', () => {
      console.log('✅ Connected to socket server (results):', socket.id);
    });

    // Receive all approved submissions on initial connection
    socketRef.current.on('allsubmissions', (data) => {
      const approvedSubmissions = data.filter(s => s.approved)
      console.log('📦 Approved submissions on boot:', approvedSubmissions);
      setSubmissions(approvedSubmissions);
    });

    // Handle submission approval/rejection updates from admin
    socketRef.current.on('submission-updated', (submission) => {
      console.log('update', submission);
      if (!submission.approved) {
        // Remove from submissions list
        setSubmissions(prev => prev.filter(s => s.timestamp !== submission.timestamp))
        console.log('if this submission in a position, remove it', submission.timestamp)
        // Clear from any position displaying it
        setPositions(prev => prev.map(p => p.submission?.timestamp === submission.timestamp ? { ...p, submission: null } : p))
      } else {
        // Add newly approved submission
        setSubmissions(prev => [...prev, submission]);
      }
    });

    // Admin pressed "clear" - reset all positions to empty
    socketRef.current.on('clear', () => {
      setPositions(projectorPositions)
      intervals.current.forEach(i => clearInterval(i))
    })

    // Admin pressed "start" - begin placing submissions every 500ms
    socketRef.current.on('start', () => {
      console.log('submissions:', submissions)
      intervals.current.forEach(i => clearInterval(i)); // Clear any existing intervals
      setPositions(projectorPositions) // Reset positions
      intervals.current.push(setInterval(addSubmissionToPosition, 500)); // Start placement loop
    })

    // Cleanup on unmount
    return () => {
      timeouts.current.forEach(t => clearTimeout(t));
      intervals.current.forEach(i => clearInterval(i));
      socketRef.current.disconnect();
    }
  }, []);

  // Toggle debug mode with F1 key
  const keyDown = ({ key }) => {
    if (key === 'F1') setDebug(prev => !prev);
  };

  // Setup keyboard listener for debug mode
  useEffect(() => {
    addEventListener('keydown', keyDown);

    return () => {
      removeEventListener('keydown', keyDown);
    };
  }, []);

  // Set CSS variables for projector dimensions
  useEffect(() => {
    document.documentElement.style.setProperty('--projector-width', `${PROJECTOR_CONFIG.WIDTH}px`);
    document.documentElement.style.setProperty('--projector-height', `${PROJECTOR_CONFIG.HEIGHT}px`);
  }, []);

  // Calculate scale to fit projector resolution to current window size
  useEffect(() => {
    const aspectRatio = PROJECTOR_CONFIG.ASPECT_RATIO;
    const windowRatio = width / height;
    // Scale to fit within window while maintaining aspect ratio
    const newScale = windowRatio < aspectRatio
      ? width / PROJECTOR_CONFIG.WIDTH   // Window is narrower, fit to width
      : height / PROJECTOR_CONFIG.HEIGHT; // Window is wider, fit to height
    setScale(newScale);
  }, [width, height]);

  return (
    <div className={`results ${debug ? 'debug' : ''}`} style={{ transform: `scale(${scale})` }}>
      {/* Container scaled to projector dimensions, then scaled down to fit window */}
      <div className="results-positions2">
        {/* Render each position in the grid */}
        {positions.map(position => (
          <span
            key={position.id}
            className="results-positions2-submission"
            style={{
              // Position using normalized coordinates (0-1 range converted to %)
              top: `${position.y * 100}%`,
              left: `${position.x * 100}%`,
            }}
          >
            {position.submission ? (
              // Render the drawing with animated replay
              <CanvasPreview
                key={position.submission.timestamp}
                strokes={position.submission.data}
                id={position.submission.timestamp}
              />
            ) : (
              // Empty placeholder when no submission assigned
              <span className="empty" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * CanvasPreview - Renders a single submission's drawing with animated replay
 * Canvas dimensions match the question page drawing area (1692×936)
 */
const CanvasPreview = ({ strokes, id }) => {
  const canvasRef = useRef();
  const width = 1692;
  const height = 1056 - 120; // 936px (1056 - 120 for header area)
  const [rotation] = useState(() => Math.random() * 20 - 10); // Random rotation between -10 and 10 degrees

  /**
   * Draws stroke data to canvas using perfect-freehand library
   * Converts pressure-sensitive points into smooth, variable-width strokes
   */
  const drawPoints = (strokesArray, clear = true) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    if (clear) ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'black'; // White ink on dark background
    strokesArray.forEach(stroke => {
      // Convert points {x, y, pressure} to array format [x, y, pressure]
      const input = stroke.map(p => [p.x, p.y, p.pressure]);
      // Generate smooth outline from pressure-sensitive points
      const outline = getStroke(input);
      // Convert outline points to SVG path and render
      const path = new Path2D(ptsToSvgPath(outline));
      ctx.fill(path);
    });
  };

  /**
   * Animate the drawing stroke-by-stroke based on timestamp data
   * Plays back at 2× speed
   */
  const replay = () => {
    if (!strokes.length) return;
    const flatPoints = strokes.flat();
    let i = 1;
    const speed = 2; // 2× playback speed
    const animationStart = performance.now();
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const animate = () => {
      const now = performance.now();
      const elapsed = (now - animationStart) * speed;

      // Build up strokes progressively based on elapsed time
      const tempStrokes = strokes.map(() => []);
      for (let s = 0; s < strokes.length; s++) {
        for (let j = 0; j < strokes[s].length; j++) {
          const pt = strokes[s][j];
          // Only include points whose timestamp has been reached
          if (pt.t <= elapsed) {
            tempStrokes[s].push(pt);
          }
        }
      }

      drawPoints(tempStrokes);

      // Continue animation until all points are drawn
      if (flatPoints[i] && flatPoints[i].t <= elapsed) i++;
      if (i < flatPoints.length) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  // Start replay animation after 1s fade-in
  useEffect(() => {
    const fadeInDuration = 1000;
    const timer = setTimeout(() => {
      replay();
    }, fadeInDuration);

    return () => clearTimeout(timer);
  }, []);

  return <canvas ref={canvasRef} width={1692} height={1056 - 120} className={`preview-canvas ${id}`} style={{ transform: `rotate(${rotation}deg)` }} />;
};

export default Results;
