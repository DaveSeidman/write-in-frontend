import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils"; // make sure this path is valid
import './index.scss';

const Admin = () => {
  const socketRef = useRef();
  const [submissions, setSubmissions] = useState([]);

  const deleteAll = () => {
    if (confirm(`This will delete all ${submissions.length} submissions, are you sure?`)) {
      socketRef.current.emit('deleteAll');
    }
  }

  const start = () => {
    if (confirm('This will clear the wall and start animating subbmissions immediately, are you sure?')) {
      socketRef.current.emit('start');
    }
  }

  const clear = () => {
    if (confirm('This will clear the wall after which you can start animating')) {
      socketRef.current.emit('clear');
    }
  }

  useEffect(() => {
    const isLocalhost = window.location.hostname !== 'daveseidman.github.io';
    const URL = isLocalhost
      ? `http://${location.hostname}:8000`
      : 'https://write-in-backend.onrender.com/';

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
            // TODO: move this into the sort?
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
      <h1 className="admin-title">Admin</h1>
      <button type="button" onClick={clear}>Clear Walls</button>
      <button type="button" onClick={start} disabled={submissions.length === 0}>Start Animation</button>
      <div className="submission-list">
        {submissions.map((submission) => {
          const date = new Date(submission.timestamp);
          const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true, });
          return (
            <div
              key={submission.timestamp}
              className={`submission-item ${submission.approved === true ? 'approved' : submission.approved === false ? 'denied' : ''}`}
              style={{ opacity: submission.approved || submission.denied ? 0.5 : 1 }}
            >
              <p>submitted at {timeString}</p>
              <CanvasPreview points={submission.data} />
              <div className="actions">
                <button disabled={submission.approved === true} onClick={() => handleAction(submission.timestamp, 'approve')}>
                  Approve
                </button>
                <button disabled={submission.approved === false} onClick={() => handleAction(submission.timestamp, 'deny')}>
                  Deny
                </button>
                <button onClick={() => handleAction(submission.timestamp, 'delete')}>
                  Delete
                </button>
              </div>
            </div>
          )
        }
        )}
      </div>
      <button type="button" onClick={deleteAll} disabled={submissions.length === 0}>Delete All Submissions</button>

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
    ctx.fillStyle = 'white';

    points.forEach(strokePoints => {
      if (!Array.isArray(strokePoints) || strokePoints.length === 0) return;

      const strokeInput = strokePoints.map(p => [p.x, p.y, p.pressure]);
      const outline = getStroke(strokeInput);
      const path = new Path2D(ptsToSvgPath(outline));
      ctx.fill(path);
    });
  }, [points]);

  return <canvas ref={canvasRef} width={1692} height={1056 - 120} className="preview-canvas" />;
};

// Sort by: unreviewed first (timestamp desc), then reviewed (timestamp desc)
function sortSubmissions(subs) {
  return subs.slice().sort((a, b) => {
    const aReviewed = a.approved !== null;
    const bReviewed = b.approved !== null;
    if (aReviewed === bReviewed) {
      return b.timestamp - a.timestamp; // newest first
    }
    return aReviewed ? 1 : -1; // reviewed go last
  });
}

export default Admin;
