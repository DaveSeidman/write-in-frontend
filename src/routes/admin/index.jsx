import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getStroke } from "perfect-freehand";
import './index.scss';

const Admin = () => {
  const socketRef = useRef();
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost';
    const URL = isLocalhost
      ? 'http://localhost:8000'
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
      <div className="submission-list">
        {submissions.map((submission) => (
          <div
            key={submission.timestamp}
            className="submission-item"
            style={{ opacity: submission.approved || submission.denied ? 0.5 : 1 }}
          >
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

const CanvasPreview = ({ points }) => {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const stroke = getStroke(points);

    const path = new Path2D();
    if (stroke.length) {
      path.moveTo(stroke[0][0], stroke[0][1]);
      for (let i = 1; i < stroke.length; i++) {
        path.lineTo(stroke[i][0], stroke[i][1]);
      }
    }

    ctx.fillStyle = 'black';
    ctx.fill(path);
  }, [points]);

  return <canvas ref={canvasRef} width={800} height={400} className="preview-canvas" />;
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
