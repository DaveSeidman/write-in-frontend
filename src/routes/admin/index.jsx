import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils"; // make sure this path is valid
import './index.scss';

const Admin = () => {
  const socketRef = useRef();
  const [submissions, setSubmissions] = useState([]);

  const reset = () => {
    if (confirm(`This will remove all ${submissions.length} submissions, are you sure?`)) {
      socketRef.current.emit('clear');
    }
  }

  const restart = () => {
    if (confirm(`This will clear the wall and start animating subbmissions immediately, are you sure?`)) {
      socketRef.current.emit('restart');
    }
  }

  useEffect(() => {
    const isLocalhost = window.location.hostname !== 'daveseidman.github.io';
    const URL = isLocalhost
      ? `http://${location.hostname}:8000`
      : 'https://cocktail-generator-server.onrender.com/';

    const socket = io(URL, {
      transports: ['websocket'],
      query: { role: 'admin' }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to socket server:', socket.id);
    });

    socket.on('allsubmissions', (data) => {
      console.log('📥 All submissions:', data);
      setSubmissions(sortSubmissions(data));
    });

    socket.on('submission', (data) => {
      console.log('📥 New submission:', data);
      setSubmissions(prev => sortSubmissions([data, ...prev]));
    });

    socket.on('submission-updated', (updated) => {
      setSubmissions(prev =>
        sortSubmissions(
          prev.map(sub =>
            sub.timestamp === updated.timestamp ? updated : sub
          )
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleAction = (timestamp, action) => {
    if (!socketRef.current) return;
    socketRef.current.emit(action, timestamp);
  };

  return (
    <div className="admin">
      <h1>Admin</h1>
      <button type="button" onClick={reset} disabled={submissions.length === 0}>Clear All Submissions</button>
      <button type="button" onClick={restart} disabled={submissions.length === 0}>Restart Animation</button>
      <div className="submission-list">
        {submissions.map((submission) => (
          <div
            key={submission.timestamp}
            className={`submission-item ${submission.approved ? 'approved' : ''} ${submission.denied ? 'denied' : ''}`}
            style={{ opacity: submission.approved || submission.denied ? 0.5 : 1 }}
          >
            {/* TODO, add a green check or red X in the corner if this submission was approved or denied */}
            <CanvasPreview points={submission.data} />
            <div className="actions">
              <button onClick={() => handleAction(submission.timestamp, 'approve')}>
                Approve
              </button>
              <button onClick={() => handleAction(submission.timestamp, 'deny')}>
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// TODO: move this into a component
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

      const strokeInput = strokePoints.map(p => [p.x, p.y, p.pressure]);
      const outline = getStroke(strokeInput);
      const path = new Path2D(ptsToSvgPath(outline));
      ctx.fill(path);
    });
  }, [points]);

  return <canvas ref={canvasRef} width={1200} height={800 - 120} className="preview-canvas" />;
};

// Sort by: unreviewed first (timestamp desc), then reviewed (timestamp desc)
function sortSubmissions(subs) {
  return subs
    .slice()
    .sort((a, b) => {
      const aReviewed = a.approved || a.denied;
      const bReviewed = b.approved || b.denied;
      if (aReviewed === bReviewed) {
        return b.timestamp - a.timestamp; // newest first
      }
      return aReviewed ? 1 : -1; // reviewed go last
    });
}

export default Admin;
