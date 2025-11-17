import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateQuestionsFromResume, evaluateAnswer, summarizeInterviewPerformance } from '../services/geminiService';
import ProctoringView from './ProctoringView';
import { Spinner, RecordIcon, ThumbsUpIcon, LightbulbIcon } from './icons';
import type { TerminationReason } from '../types';
import Chart from 'chart.js/auto';

type ProctoringStatus = 'pending' | 'ready' | 'error';
type InterviewState = 'upload' | 'generating' | 'inProgress' | 'evaluating' | 'summarizing' | 'results';
type InterviewPhase = 'thinking' | 'recording' | 'idle';

interface InterviewResult {
  question: string;
  answer: string;
  feedback: string;
  score: number;
}

interface PerformanceSummary {
    strengths: string;
    areasForImprovement: string;
}

// Check for SpeechRecognition API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
let recognition: any;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
}

const fileToDataUrl = (file: File): Promise<{base64: string, mimeType: string}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        const [meta, base64] = result.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        if (base64) {
            resolve({ base64, mimeType });
        } else {
            reject(new Error("Could not read file as base64."));
        }
    };
    reader.onerror = error => reject(error);
  });
};

const ResultsView: React.FC<{ 
    results: InterviewResult[]; 
    summary: PerformanceSummary | null;
    onEndSession: () => void;
}> = ({ results, summary, onEndSession }) => {
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const maxScore = results.length * 5;
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const [openAccordion, setOpenAccordion] = useState<number | null>(null);
    const doughnutChartRef = useRef<HTMLCanvasElement>(null);
    const barChartRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
        const pointColor = theme === 'dark' ? '#f8fafc' : '#1e293b';

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
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1200
                    }
                }
            });
        }

        let barChart: Chart | null = null;
        if (barChartRef.current) {
            barChart = new Chart(barChartRef.current, {
                type: 'bar',
                data: {
                    labels: results.map((_, i) => `Q${i+1}`),
                    datasets: [{
                        label: 'Score',
                        data: results.map(r => r.score),
                        backgroundColor: results.map(r => r.score >= 4 ? 'rgba(34, 197, 94, 0.7)' : r.score === 3 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                        borderColor: results.map(r => r.score >= 4 ? '#16a34a' : r.score === 3 ? '#d97706' : '#dc2626'),
                        borderWidth: 2,
                        borderRadius: 6,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true, max: 5, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 }
                        },
                        x: {
                            grid: { display: false }, ticks: { color: textColor }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                           backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                           titleColor: textColor,
                           bodyColor: textColor,
                           borderColor: gridColor,
                           borderWidth: 1,
                        }
                    }
                }
            });
        }

        return () => {
            doughnutChart?.destroy();
            barChart?.destroy();
        };
    }, [results, percentage]);
    
    const AccordionItem = ({ result, index, open, onToggle }: { result: InterviewResult, index: number, open: boolean, onToggle: () => void }) => ( <div className="bg-white/60 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700"><h2><button type="button" className="flex items-center justify-between w-full p-5 font-medium text-left text-slate-800 dark:text-white" onClick={onToggle} aria-expanded={open}><span className="flex items-center"><span className="font-bold mr-3">Q{index + 1}:</span><span className="truncate pr-4">{result.question}</span></span><div className="flex items-center"><span className={`mr-4 font-bold ${result.score >= 4 ? 'text-green-500' : result.score === 3 ? 'text-yellow-500' : 'text-red-500'}`}>{result.score}/5</span><svg className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5 5 1 1 5"/></svg></div></button></h2><div className={`${open ? '' : 'hidden'}`}><div className="p-5 border-t border-slate-200 dark:border-slate-700"><p className="text-sm text-slate-500 dark:text-slate-400 italic p-3 bg-slate-100 dark:bg-slate-900 rounded-md mb-3">Your answer: "{result.answer}"</p><div className="p-3 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-md"><p className="font-semibold text-indigo-800 dark:text-indigo-300">Feedback:</p><p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">{result.feedback}</p></div></div></div></div>);

    return (<div className="w-full max-w-5xl p-4 animate-fade-in-up"><h1 className="text-4xl font-bold text-center mb-8">Interview Performance</h1><div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"><div className="lg:col-span-1 bg-white/60 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center"><h2 className="text-xl font-bold mb-4">Overall Score</h2><div className="relative w-48 h-48"><canvas ref={doughnutChartRef}></canvas><div className="absolute inset-0 flex items-center justify-center text-4xl font-extrabold text-slate-800 dark:text-white">{percentage}%</div></div><p className="text-2xl font-bold mt-4 text-slate-700 dark:text-slate-300">{totalScore} / {maxScore}</p></div><div className="lg:col-span-2 bg-white/60 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700"><h2 className="text-xl font-bold mb-4">AI Summary</h2><div className="space-y-4"><div className="flex items-start"><ThumbsUpIcon className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" /><div><h3 className="font-semibold text-slate-800 dark:text-white">Strengths</h3><p className="text-sm text-slate-600 dark:text-slate-300">{summary?.strengths}</p></div></div><div className="flex items-start"><LightbulbIcon className="w-6 h-6 text-yellow-500 mr-3 mt-1 flex-shrink-0" /><div><h3 className="font-semibold text-slate-800 dark:text-white">Areas for Improvement</h3><p className="text-sm text-slate-600 dark:text-slate-300">{summary?.areasForImprovement}</p></div></div></div></div></div><div className="bg-white/60 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mb-8"><h2 className="text-xl font-bold mb-4">Score Breakdown</h2><div className="h-64"><canvas ref={barChartRef}></canvas></div></div><div><h2 className="text-2xl font-bold text-center mb-6">Detailed Feedback</h2><div className="space-y-2">{results.map((result, index) => (<AccordionItem key={index} result={result} index={index} open={openAccordion === index} onToggle={() => setOpenAccordion(openAccordion === index ? null : index)} />))}</div></div><div className="text-center mt-12"><button onClick={onEndSession} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg">Back to Dashboard</button></div></div>);
};


const ResumeInterviewPage: React.FC<{ 
  onTerminate: (reason: TerminationReason, message: string) => void;
  onEndSession: () => void;
}> = ({ onTerminate, onEndSession }) => {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [interviewState, setInterviewState] = useState<InterviewState>('upload');
  const [error, setError] = useState<string | null>(null);
  const [proctoringStatus, setProctoringStatus] = useState<ProctoringStatus>('pending');
  const [proctoringError, setProctoringError] = useState<string>('');
  
  const [interviewPhase, setInterviewPhase] = useState<InterviewPhase>('idle');
  const [timer, setTimer] = useState(10);
  const [transcribedText, setTranscribedText] = useState('');
  const [allAnswers, setAllAnswers] = useState<string[]>([]);
  const [interviewResults, setInterviewResults] = useState<InterviewResult[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false); // State lock to prevent race conditions
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const [faceDetectionWarnings, setFaceDetectionWarnings] = useState(0);
  const proctoringWarningRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(recognition);
  const latestTranscript = useRef('');
  const isTerminatedRef = useRef(false);

  // --- Face Detection Proctoring ---
  const handleFaceOutOfFrame = useCallback(() => {
    if (isTerminatedRef.current || interviewState !== 'inProgress') return;
    
    if (faceDetectionWarnings === 0) {
      setFaceDetectionWarnings(1);
      if (proctoringWarningRef.current) {
        proctoringWarningRef.current.style.opacity = '1';
        setTimeout(() => {
          if (proctoringWarningRef.current) proctoringWarningRef.current.style.opacity = '0';
        }, 4000);
      }
    } else {
      isTerminatedRef.current = true;
      onTerminate('face_detection', 'Interview terminated due to repeated face detection issues.');
    }
  }, [faceDetectionWarnings, onTerminate, interviewState]);
  // --- End Proctoring Logic ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
          setError('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
          return;
      }
      setResumeFile(file);
      setError(null);
    }
  };

  const handleStartInterview = useCallback(async () => {
    if (!resumeFile) return;
    setInterviewState('generating');
    try {
        const fileData = await fileToDataUrl(resumeFile);
        const generatedQuestions = await generateQuestionsFromResume(fileData);
        if (generatedQuestions && generatedQuestions.length > 0 && !generatedQuestions[0].toLowerCase().includes('could not')) {
          setQuestions(generatedQuestions);
          setAllAnswers(new Array(generatedQuestions.length).fill(''));
          setInterviewState('inProgress');
        } else {
          setError(generatedQuestions[0] || "AI could not generate questions from this resume.");
          setInterviewState('upload');
        }
    } catch (err) {
        setError("An unexpected error occurred.");
        setInterviewState('upload');
    }
  }, [resumeFile]);
  
  // --- Timed Interview Flow ---
  const handleAdvanceAfterRecording = useCallback(() => {
    if (isAdvancing || isTerminatedRef.current) return; // The critical lock check
    setIsAdvancing(true);

    recognitionRef.current?.stop();
    const finalAnswer = latestTranscript.current.trim();
    setAllAnswers(prev => {
        const newAnswers = [...prev];
        newAnswers[currentQuestionIndex] = finalAnswer;
        return newAnswers;
    });

    if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(i => i + 1);
    } else {
        setInterviewState('evaluating');
    }
  }, [isAdvancing, currentQuestionIndex, questions.length]);

  useEffect(() => {
    if (interviewState === 'inProgress' && currentQuestionIndex < questions.length) {
      setInterviewPhase('thinking');
      setTimer(10);
      setTranscribedText('');
      latestTranscript.current = '';
      setIsAdvancing(false); // Release the lock for the new question
      setRecognitionError(null); // Clear error on new question
    }
  }, [interviewState, currentQuestionIndex, questions.length]);

  useEffect(() => {
    if (isTerminatedRef.current) return;

    const rec = recognitionRef.current;
    if (!rec) return;

    rec.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      latestTranscript.current += finalTranscript + ' ';
      setTranscribedText(latestTranscript.current);
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      let errorMessage = "An unknown microphone error occurred.";
      if (event.error === 'no-speech') {
          errorMessage = "We didn't hear you. Please ensure your microphone is working and speak clearly.";
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          errorMessage = "Microphone access was denied. Please check your browser permissions.";
      } else if (event.error === 'audio-capture') {
          errorMessage = "There was a problem with your microphone. Please check your hardware.";
      }
      setRecognitionError(errorMessage);
      handleAdvanceAfterRecording();
    };

    return () => {
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.stop();
      }
    };
  }, [handleAdvanceAfterRecording]);

  useEffect(() => {
    if (interviewState !== 'inProgress' || isTerminatedRef.current) return;

    if (timer > 0) {
      const countdown = setTimeout(() => setTimer(t => t - 1), 1000);
      return () => clearTimeout(countdown);
    } else {
      if (interviewPhase === 'thinking') {
        setInterviewPhase('recording');
        setTimer(30);
        recognitionRef.current?.start();
      } else if (interviewPhase === 'recording') {
        handleAdvanceAfterRecording();
      }
    }
  }, [timer, interviewPhase, interviewState, handleAdvanceAfterRecording]);
  // --- End Timed Flow ---

  // --- Batch Evaluation Flow ---
  useEffect(() => {
    const evaluateAllAnswers = async () => {
      const evaluationPromises = questions.map((q, i) => evaluateAnswer(q, allAnswers[i] || "[No answer recorded]"));
      const evaluatedResults = await Promise.all(evaluationPromises);
      
      const finalResults = questions.map((q, i) => ({
        question: q,
        answer: allAnswers[i] || "[No answer recorded]",
        ...evaluatedResults[i],
      }));
      setInterviewResults(finalResults);
      setInterviewState('summarizing');
    };

    if (interviewState === 'evaluating') {
      evaluateAllAnswers();
    }
  }, [interviewState, questions, allAnswers]);

  useEffect(() => {
    const summarize = async () => {
        const summary = await summarizeInterviewPerformance(interviewResults);
        setPerformanceSummary(summary);
        setInterviewState('results');
    };
    if (interviewState === 'summarizing') {
        summarize();
    }
  }, [interviewState, interviewResults]);
  // --- End Evaluation Flow ---

  const renderUploadView = () => ( <div className="text-center flex flex-col items-center"><h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-4">Resume Based Interview</h1><p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-2xl">Upload your resume. Our AI will generate personalized interview questions.</p><div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg p-8 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-md"><label htmlFor="resume-upload" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Upload your resume (PDF, DOCX, TXT)</label><input id="resume-upload" type="file" onChange={handleFileChange} accept=".pdf,.txt,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"/><p className="text-red-500 mt-4 text-sm text-left">{error}</p>{resumeFile && !error && <p className="text-slate-600 dark:text-slate-400 mt-4 text-sm text-left">Selected: {resumeFile.name}</p>}<button onClick={handleStartInterview} disabled={!resumeFile || !!error} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center">Start Interview</button></div></div>);
  
  const renderInProgressView = () => (
    <div className="w-full max-w-4xl flex flex-col items-center animate-fade-in-up text-center">
        <p className="text-slate-500 dark:text-slate-400 mb-2 font-medium">Question {currentQuestionIndex + 1} of {questions.length}</p>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-8 leading-snug">{questions[currentQuestionIndex]}</h2>
        
        <div className="relative w-48 h-48 flex items-center justify-center mb-6">
            <div className={`absolute inset-0 border-8 rounded-full transition-colors ${interviewPhase === 'recording' ? 'border-red-500' : 'border-indigo-500'}`}></div>
            <div className="absolute inset-0 rounded-full" style={{
                background: `conic-gradient(${interviewPhase === 'recording' ? '#ef4444' : '#6366f1'} ${timer * (360 / (interviewPhase === 'thinking' ? 10 : 30))}deg, transparent 0deg)`
            }}></div>
            <div className="w-36 h-36 bg-white/80 dark:bg-slate-800/80 rounded-full flex flex-col items-center justify-center">
                <p className="text-5xl font-bold">{timer}</p>
                <p className="text-sm uppercase tracking-widest text-slate-500 dark:text-slate-400">{interviewPhase}</p>
            </div>
        </div>

        <div className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <textarea
                value={transcribedText}
                readOnly
                placeholder="Your transcribed answer will appear here in real-time..."
                className="w-full h-24 p-3 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700"
            />
        </div>
        {recognitionError && <p className="mt-4 text-center text-red-500 dark:text-red-400 text-sm font-medium animate-fade-in-up">{recognitionError}</p>}
        <div ref={proctoringWarningRef} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg shadow-2xl opacity-0 transition-opacity duration-500">
            Warning: Please remain visible in the camera frame.
        </div>
    </div>
  );
  
  const renderInterviewContent = () => {
    switch(interviewState) {
        case 'generating':
        case 'evaluating':
        case 'summarizing':
             return (<div className="text-center flex flex-col items-center"><Spinner /><p className="mt-4 text-xl text-slate-600 dark:text-slate-300">{interviewState === 'generating' ? 'Analyzing resume...' : interviewState === 'evaluating' ? 'Evaluating all answers...' : 'Generating performance summary...'}</p></div>);
        case 'inProgress': return renderInProgressView();
        case 'results': return <ResultsView results={interviewResults} summary={performanceSummary} onEndSession={onEndSession} />;
        case 'upload':
        default: return renderUploadView();
    }
  };

  if (proctoringStatus === 'pending') { return (<div className="min-h-screen w-full flex flex-col items-center justify-center p-4"><Spinner /><p className="mt-4 text-xl text-slate-600 dark:text-slate-300">Waiting for camera & microphone permissions...</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-500">Please check your browser for a permission prompt.</p><div className="opacity-0 invisible absolute"><ProctoringView onReady={() => setProctoringStatus('ready')} onError={(err) => { setProctoringStatus('error'); setProctoringError(err); }} /></div></div>); }
  if (proctoringStatus === 'error') { return (<div className="min-h-screen w-full flex flex-col items-center justify-center p-4 text-center"><h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Permission Error</h2><p className="text-slate-600 dark:text-slate-300 max-w-md mb-6">{proctoringError}</p><button onClick={onEndSession} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">Back to Dashboard</button></div>); }
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      {renderInterviewContent()}
      <ProctoringView 
        onReady={() => {}} 
        onError={(err) => { setProctoringStatus('error'); setProctoringError(err); }}
        enableFaceDetection={interviewState === 'inProgress'}
        onFaceOutOfFrame={handleFaceOutOfFrame}
      />
    </div>
  );
};

export default ResumeInterviewPage;