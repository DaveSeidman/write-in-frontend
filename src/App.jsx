import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Quiz from './routes/quiz';
import Question from './routes/question';
import Results from './routes/results';
import Admin from './routes/admin';
import './index.scss';

function App() {
  return (
    <div className='app'>
      <Routes>
        <Route path="/" element={
          <div className="menu">
            {/* <a href="#/quiz">Quiz</a> */}
            <a href="#/question">Question</a>
            <a href="#/admin">Admin</a>
            <a href="#/results">Results</a>
          </div>
        } />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/question" element={<Question />} />
        <Route path="/results" element={<Results />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  );
}

export default App;
