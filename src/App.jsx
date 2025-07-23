import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Admin from './routes/admin';
import Quiz from './routes/quiz';
import Results from './routes/results';
import './index.scss';

function App() {
  return (
    <div className='app'>
      <Routes>
        <Route path="/" element={
          <div className="menu">
            <a href="/quiz">Quiz</a>
            <a href="/results">Results</a>
            <a href="/admin">Admin</a>
          </div>
        } />
        <Route path="/admin" element={<Admin />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </div>
  );
}

export default App;
