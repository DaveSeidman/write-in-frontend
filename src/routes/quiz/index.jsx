import React, { useState } from "react";
import quiz from '../../assets/data/quiz1.json';
import './index.scss';

const Quiz = ({ }) => {

  const [questionIndex, setQuestionIndex] = useState(0);
  const [resultIndex, setResultIndex] = useState();
  const [complete, setComplete] = useState(false);

  const recordAnswer = (e) => {
    if (questionIndex < quiz.questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setComplete(true);
      setResultIndex(Math.floor(Math.random() * quiz.results.length))
    }
  }

  return (
    <div className="quiz">
      <h1 className="quiz-title">{quiz.title}</h1>
      <div className={`quiz-questions ${!complete ? '' : 'hidden'}`}>
        {quiz.questions.map((question, index) => (
          <div
            key={question.id}
            className={`quiz-questions-question ${questionIndex === index ? '' : 'hidden'}`}
          >
            <h2 className="quiz-questions-question-title">{question.question}</h2>
            <ul className="quiz-questions-question-answers">
              {question.answers.map(answer => (
                <li
                  key={answer.id}
                  className="quiz-questions-question-answers-answer"
                  onClick={recordAnswer}
                >{answer.answer}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={`quiz-results ${complete ? '' : 'hidden'}`}>
        <h1>You're a</h1>
        <h2>{quiz.results[resultIndex]?.name}</h2>
        <p>{quiz.results[resultIndex]?.description}</p>
        <p>{quiz.results[resultIndex]?.ingredients}</p>
      </div>
    </div>
  )
}
export default Quiz;