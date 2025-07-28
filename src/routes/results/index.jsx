import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils"; // adjust if needed
import { useWindowSize } from 'react-use';
import { io } from "socket.io-client";
import projectorPositions from '../../assets/data/projector-positions.json'

import './index.scss';

const Results = () => {
  const isLocalhost = window.location.hostname !== 'daveseidman.github.io';
  const URL = isLocalhost
    ? `http://${location.hostname}:8000`
    : 'https://cocktail-generator-server.onrender.com/';

  const [submissions, setSubmissions] = useState([]);
  const socketRef = useRef();
  const { width, height } = useWindowSize();
  const [scale, setScale] = useState(1);
  const [positions, setPositions] = useState(projectorPositions);

  const removeSubmissionsInterval = useRef();
  const addSubmissionsInterval = useRef();

  // console.log(positions)
  useEffect(() => {
    const socket = io(URL, {
      transports: ['websocket'],
      query: { role: 'results' }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to socket server (results):', socket.id);
    });

    // TODO: change to "existing-submissions"?
    socket.on('approvedsubmissions', (data) => {
      console.log('📦 Approved submissions on boot:', data);
      setSubmissions(data.sort((a, b) => b.timestamp - a.timestamp));
    });

    socket.on('submission-updated', (submission) => {
      if (!submission.approved) {
        // Remove the denied submission from the list
        setSubmissions(prev =>
          prev.filter(s => s.timestamp !== submission.timestamp)
        );
        return;
      }

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


  useEffect(() => {
    console.log('assign submissions to positions');
    if (!submissions.length) return;

    const nextPositions = [...positions];
    // loop over each position and give it a random submission (or a % blank?)
    nextPositions.forEach(position => {
      if (position.submission === null) {
        position.submission = submissions[Math.floor(Math.random() * submissions.length)];
      }
    })
    console.log({ nextPositions })
    setPositions(nextPositions)

  }, [submissions])

  const removeSubmissions = () => {
    const nextPositions = [...positions];
    nextPositions.forEach(position => {
      if (Math.random() > .9) {
        position.submission = null;
      }
    })
    setPositions(nextPositions)
  }

  const addSubmissions = () => {
    const nextPositions = [...positions];
    nextPositions.forEach(position => {
      if (Math.random() > 0.5 && !position.submission) {
        position.submission = submissions[Math.floor(Math.random() * submissions.length)]
      }
    })
    setPositions(nextPositions)
  }

  useEffect(() => {
    removeSubmissionsInterval.current = setInterval(removeSubmissions, 1000);
    setTimeout(() => {
      addSubmissionsInterval.current = setInterval(addSubmissions, 1000);
    }, 500)

    return (() => {
      if (removeSubmissionsInterval.current) clearInterval(removeSubmissionsInterval.current);
      if (addSubmissionsInterval.current) clearInterval(addSubmissionsInterval.current);
    })

  }, [])

  // Scale to fit
  useEffect(() => {
    const projectorWidth = 3840;
    const projetorHeight = 2160;
    const projectorAspect = projectorWidth / projetorHeight;
    const windowAspect = width / height;
    let nextScale = 1;
    if (projectorAspect < windowAspect) {
      nextScale = height / projetorHeight;
    } else {
      nextScale = width / projectorWidth;
    }
    setScale(nextScale);
  }, [width, height]);

  return (
    <div className="results" style={{ transform: `scale(${scale})` }}>
      {/* <div className="submission-list">
        {submissions.map((submission) => (
          <CanvasPreview
            key={submission.timestamp}
            strokes={submission.data}
          // animated={false}
          />
        ))}
      </div> */}

      <div className="results-positions2">
        {positions.map(position =>
        (<span
          className="results-positions2-submission"
          style={{
            top: `${position.y * 100}%`,
            left: `${position.x * 100}%`,
          }}>
          {position.submission && (
            <CanvasPreview
              key={position.submission.timestamp}
              strokes={position.submission.data}
            />
          )}
        </span>
        )
        )}
      </div>

      {/* <div className="results-positions">
        {projectorPositions.map(position => (
          <span
            className="results-positions-position"
            style={{
              top: `${position.y * 100}%`,
              left: `${position.x * 100}%`,
            }}
          >{position.id}</span>
        ))}
      </div> */}
    </div>
  );
};


// TODO: extract this, should be available here and to /admin
const CanvasPreview = ({ strokes }) => {
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

    const animationStart = performance.now(); // <-- FIXED: animation timeline starts now
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const animate = () => {
      const now = performance.now();
      const elapsed = now - animationStart; // <-- FIXED: relative to wall-clock now

      let tempStrokes = strokes.map(() => []);
      for (let s = 0; s < strokes.length; s++) {
        for (let j = 0; j < strokes[s].length; j++) {
          const pt = strokes[s][j];
          if (pt.t <= elapsed) { // <-- FIXED: use pt.t directly
            tempStrokes[s].push(pt);
          }
        }
      }

      drawPoints(tempStrokes);

      if (flatPoints[i] && flatPoints[i].t <= elapsed) {
        i++;
      }
      if (i < flatPoints.length) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };


  useEffect(() => {
    replay();
  }, [])

  return <canvas ref={canvasRef} width={800} height={400} className="preview-canvas" />;
};


export default Results;
