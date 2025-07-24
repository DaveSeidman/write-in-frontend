import React, { useRef, useEffect } from "react";
import { io } from "socket.io-client";

import './index.scss';

const Admin = ({ }) => {

  const socketRef = useRef();

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost';
    const URL = isLocalhost
      ? 'http://localhost:8000'
      : 'https://cocktail-generator-server.onrender.com/';

    const socket = io(URL, {
      transports: ['websocket'],
      query: { role: 'question' } // optional for future filtering
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server:', socket.id);
    });

    socket.on('submission', (data) => {
      console.log({ data })
    })

    return () => {
      socket.disconnect();
    };
  }, []);
  return (
    <div className="admin">
      <h1>Admin</h1>
    </div>
  )
}
export default Admin;