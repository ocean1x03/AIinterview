import React, { useState, useEffect, useRef } from 'react';
import type { MCQ, TechnicalSubject } from '../types';
import { generateMcqTest, summarizeMcqPerformance } from '../services/geminiService';
import ProctoringView from './ProctoringView';
import { Spinner, ThumbsUpIcon, LightbulbIcon } from './icons';
import Chart from 'chart.js/auto';

type ProctoringStatus = 'pending' | 'ready' | 'error';
type McqState = 'select' | 'loading' | 'inProgress' | 'summarizing' | 'results';

interface PerformanceSummary {
    strengths: string;
    areasForImprovement: string;
}

const subjects: TechnicalSubject[] = ["DBMS", "CN", "OOPS", "DSA", "OS", "C++"];

const ResultsView: React.FC<{
    subject: TechnicalSubject;
    score: number;
    questions: MCQ[];
    userAnswers: string[];
    summary: PerformanceSummary | null;
    onEndSession: () => void;
}> = ({ subject, score, questions, userAnswers, summary, onEndSession }) => {
    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const doughnutChartRef = useRef<HTMLCanvasElement>(null);
    const [openAccordion, setOpenAccordion] = useState<number | null>(null);

    useEffect(() => {
        const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        let doughnutChart: Chart | null = null;
        if (doughnutChartRef.current) {
            const percentageColor = percentage >= 70 ? '#22c55e' : percentage >= 40 ? '#f59e0b' : '#ef4444';
            doughnutChart = new Chart(doughnutChartRef.current, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [percentage, 100 - percentage],
                        backgroundColor: [percentageColor, theme === 'dark' ? '#334155' : '#e2e8f0'],
                        borderColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                        borderWidth: 4,
                        borderRadius: 8,
                    }]
                },
                options: {
                    responsive: true,
                    cutout: '80%',
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    animation: { animateRotate: true, animateScale: true, duration: 1200 }
                }
            });
        }
        return () => doughnutChart?.destroy();
    }, [percentage]);
    
    const AccordionItem = ({ question, userAnswer, correctAnswer, index, open, onToggle }: { question: MCQ, userAnswer: string, correctAnswer: string, index: number, open: boolean, onToggle: () => void }) => {
        const isCorrect = userAnswer === correctAnswer;
        return (
            <div className="bg-white/60 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
                <h2>
                    <button type="button" className="flex items-center justify-between w-full p-5 font-medium text-left text-slate-800 dark:text-white" onClick={onToggle}>
                        <span className="flex items-center">
                            <span className="font-bold mr-3">Q{index + 1}:</span>
                            <span className="truncate pr-4">{question.question}</span>
                        </span>
                         <span className={`font-bold mr-4 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                    </button>
                </h2>
                <div className={`${open ? '' : 'hidden'}`}>
                    <div className="p-5 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        <p className="text-sm">Your answer: <span className={`font-semibold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{userAnswer || 'Not answered'}</span></p>
                        {!isCorrect && <p className="text-sm">Correct answer: <span className="font-semibold text-green-600 dark:text-green-400">{correctAnswer}</span></p>}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-3xl p-4 animate-fade-in-up">
            <h1 className="text-4xl font-bold text-center mb-2">Test Results</h1>
            <p className="text-xl text-center text-slate-600 dark:text-slate-400 mb-8">{subject}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-white/60 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold mb-4">Overall Score</h2>
                    <div className="relative w-48 h-48">
                        <canvas ref={doughnutChartRef}></canvas>
                        <div className="absolute inset-0 flex items-center justify-center text-4xl font-extrabold text-slate-800 dark:text-white">{percentage}%</div>
                    </div>
                    <p className="text-2xl font-bold mt-4 text-slate-700 dark:text-slate-300">{score} / {questions.length}</p>
                </div>
                <div className="bg-white/60 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-4">AI Summary</h2>
                    <div className="space-y-4">
                        <div className="flex items-start"><ThumbsUpIcon className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" /><div><h3 className="font-semibold text-slate-800 dark:text-white">Strengths</h3><p className="text-sm text-slate-600 dark:text-slate-300">{summary?.strengths}</p></div></div>
                        <div className="flex items-start"><LightbulbIcon className="w-6 h-6 text-yellow-500 mr-3 mt-1 flex-shrink-0" /><div><h3 className="font-semibold text-slate-800 dark:text-white">Areas for Improvement</h3><p className="text-sm text-slate-600 dark:text-slate-300">{summary?.areasForImprovement}</p></div></div>
                    </div>
                </div>
            </div>
            
            <div>
                 <h2 className="text-2xl font-bold text-center mb-6">Review Answers</h2>
                 <div className="space-y-2">
                     {questions.map((q, index) => (
                         <AccordionItem key={index} question={q} userAnswer={userAnswers[index]} correctAnswer={q.correctAnswer} index={index} open={openAccordion === index} onToggle={() => setOpenAccordion(openAccordion === index ? null : index)} />
                     ))}
                 </div>
            </div>
            
            <div className="text-center mt-12"><button onClick={onEndSession} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg">Back to Dashboard</button></div>
        </div>
    );
}


const McqTestPage: React.FC<{ onEndSession: () => void }> = ({ onEndSession }) => {
  const [selectedSubject, setSelectedSubject] = useState<TechnicalSubject | null>(null);
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [mcqState, setMcqState] = useState<McqState>('select');
  const [score, setScore] = useState(0);
  const [proctoringStatus, setProctoringStatus] = useState<ProctoringStatus>('pending');
  const [proctoringError, setProctoringError] = useState<string>('');
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null);

  const handleSelectSubject = async (subject: TechnicalSubject) => {
    setSelectedSubject(subject);
    setMcqState('loading');
    const fetchedQuestions = await generateMcqTest(subject);
    setQuestions(fetchedQuestions);
    setUserAnswers(new Array(fetchedQuestions.length).fill(''));
    setMcqState('inProgress');
  };

  const handleSelectAnswer = (option: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = option;
    setUserAnswers(newAnswers);
  };
  
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      let correctAnswers = 0;
      questions.forEach((q, index) => {
        if (q.correctAnswer === userAnswers[index]) {
          correctAnswers++;
        }
      });
      setScore(correctAnswers);
      setMcqState('summarizing');
    }
  };

  useEffect(() => {
    const getSummary = async () => {
        if (mcqState === 'summarizing' && selectedSubject) {
            const summary = await summarizeMcqPerformance(selectedSubject, score, questions.length);
            setPerformanceSummary(summary);
            setMcqState('results');
        }
    };
    getSummary();
  }, [mcqState, selectedSubject, score, questions.length]);

  const renderInterviewContent = () => {
    switch (mcqState) {
        case 'loading':
            return (
                <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
                    <Spinner />
                    <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">Generating {selectedSubject} questions...</p>
                </div>
            );
        case 'summarizing':
            return (
                 <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
                    <Spinner />
                    <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">Summarizing performance...</p>
                </div>
            );
        case 'results':
             return (
                 <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
                    <ResultsView
                        subject={selectedSubject!}
                        score={score}
                        questions={questions}
                        userAnswers={userAnswers}
                        summary={performanceSummary}
                        onEndSession={onEndSession}
                    />
                 </div>
             );
        case 'inProgress':
            const currentQuestion = questions[currentQuestionIndex];
            return (
                <div className="min-h-screen w-full flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-lg p-8 shadow-2xl">
                        <p className="text-slate-500 dark:text-slate-400 mb-2 font-medium">Question {currentQuestionIndex + 1} of {questions.length} - {selectedSubject}</p>
                        <h2 className="text-2xl font-semibold mb-6">{currentQuestion.question}</h2>
                        <div className="space-y-4">
                            {currentQuestion.options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleSelectAnswer(option)}
                                className={`block w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                                userAnswers[currentQuestionIndex] === option
                                    ? 'bg-indigo-600 border-indigo-500 text-white font-semibold ring-2 ring-indigo-400'
                                    : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-200/80 dark:hover:bg-slate-600/80'
                                }`}
                            >
                                {option}
                            </button>
                            ))}
                        </div>
                        <button 
                            onClick={handleNextQuestion} 
                            disabled={!userAnswers[currentQuestionIndex]}
                            className="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
                        >
                            {currentQuestionIndex < questions.length - 1 ? 'Next' : 'Submit'}
                        </button>
                    </div>
                </div>
            );
        case 'select':
        default:
            return (
                <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
                    <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-2">MCQ Practice Test</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 mb-10">Select a subject to begin.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {subjects.map(subject => (
                        <button key={subject} onClick={() => handleSelectSubject(subject)} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-slate-200 dark:border-slate-700 p-8 rounded-lg text-slate-800 dark:text-white text-xl font-bold transition-all duration-300 transform hover:scale-105 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-xl">
                            {subject}
                        </button>
                        ))}
                    </div>
                    <button onClick={onEndSession} className="mt-12 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                        Back to Dashboard
                    </button>
                </div>
            );
    }
  };
  
  if (proctoringStatus === 'pending') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
        <Spinner />
        <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">Waiting for camera & microphone permissions...</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">Please check your browser for a permission prompt.</p>
        <div className="opacity-0 invisible absolute">
          <ProctoringView
            onReady={() => setProctoringStatus('ready')}
            onError={(err) => { setProctoringStatus('error'); setProctoringError(err); }}
          />
        </div>
      </div>
    );
  }

  if (proctoringStatus === 'error') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Permission Error</h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-md mb-6">{proctoringError}</p>
        <button onClick={onEndSession} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <>
      {renderInterviewContent()}
      <ProctoringView 
        onReady={() => {}} 
        onError={(err) => { setProctoringStatus('error'); setProctoringError(err); }} 
      />
    </>
  );
};

export default McqTestPage;