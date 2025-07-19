import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Admin from './routes/admin';
import Quiz from './routes/quiz';
import Results from './routes/results';
import './index.scss';

function App() {
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/quiz" element={<Quiz />} />
      <Route path="/results" element={<Results />} />
    </Routes>
  );
}

export default App;
