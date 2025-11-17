import { GoogleGenAI, Type } from "@google/genai";
import type { MCQ, TechnicalSubject } from '../types';

// --- DEMO MODE SAMPLE DATA ---
const sampleResumeQuestions = [
    "Can you walk me through the most challenging project on your resume?",
    "Explain the architecture of the project where you used Node.js and React.",
    "What was your specific role and contribution to the 'AI Chatbot' project?",
    "How did you handle data persistence in the 'E-commerce Platform' project?",
    "Tell me about a time you had to learn a new technology for a project listed here. What was it and what was the outcome?",
    "Describe a difficult bug you encountered in one of these projects and how you resolved it.",
    "Based on your resume, what do you consider your strongest technical skill and why?",
    "How did you ensure the scalability of the 'Social Media API' project?",
    "What is something you would do differently if you were to start your 'Data Visualization Dashboard' project today?",
    "Explain the purpose and outcome of the certification you received in Cloud Computing."
];

const sampleMcqs: MCQ[] = [
    { question: "In object-oriented programming, what is encapsulation?", options: ["The process of hiding the implementation details of an object", "The ability of an object to take on many forms", "The process of creating a new class from an existing class", "A type of data structure"], correctAnswer: "The process of hiding the implementation details of an object" },
    { question: "What does the acronym 'SQL' stand for?", options: ["Structured Query Language", "Simple Query Language", "Standard Query Log", "System Qualification Layer"], correctAnswer: "Structured Query Language" },
    { question: "Which data structure operates on a Last-In, First-Out (LIFO) basis?", options: ["Queue", "Stack", "Linked List", "Tree"], correctAnswer: "Stack" },
    { question: "What is the primary purpose of a DNS server?", options: ["To store website files", "To translate domain names to IP addresses", "To encrypt network traffic", "To manage database connections"], correctAnswer: "To translate domain names to IP addresses" },
    { question: "In CSS, what property is used to change the text color of an element?", options: ["font-color", "text-color", "color", "font-style"], correctAnswer: "color" },
    { question: "What is the time complexity of a binary search algorithm?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], correctAnswer: "O(log n)" },
    { question: "Which of the following is NOT a primitive data type in JavaScript?", options: ["String", "Number", "Array", "Boolean"], correctAnswer: "Array" },
    { question: "What does 'OS' stand for in the context of computing?", options: ["Operating System", "Open Source", "Order of Significance", "Optical Sensor"], correctAnswer: "Operating System" },
    { question: "What is the role of an operating system's kernel?", options: ["To provide a user interface", "To manage hardware resources and provide core system services", "To run application software", "To compile source code"], correctAnswer: "To manage hardware resources and provide core system services" },
    { question: "In C++, what is a constructor?", options: ["A function that is automatically called when an object is destroyed", "A special method for creating and initializing an object", "A data type for storing integers", "A loop structure"], correctAnswer: "A special method for creating and initializing an object" }
];
// --- END DEMO MODE SAMPLE DATA ---

// This function checks if the API key is available in the environment.
export const isApiKeyConfigured = (): boolean => {
    // In a real build environment, process.env.API_KEY would be replaced.
    // We check for a non-empty string.
    return !!process.env.API_KEY && process.env.API_KEY.length > 0;
}

const getAi = (): GoogleGenAI | null => {
    if (!isApiKeyConfigured()) {
        console.warn("API key not configured. The application is running in Demo Mode.");
        return null;
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper to simulate network delay for demo mode
const demoDelay = (ms: number) => new Promise(res => setTimeout(res, ms));


interface FileData {
    base64: string;
    mimeType: string;
}

export const generateQuestionsFromResume = async (fileData: FileData): Promise<string[]> => {
  if (!isApiKeyConfigured()) {
      await demoDelay(1500);
      return sampleResumeQuestions;
  }

  const ai = getAi();
  if (!ai) return ["Could not connect to the AI service."];
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: {
        parts: [
            {
                inlineData: {
                    data: fileData.base64,
                    mimeType: fileData.mimeType,
                },
            },
            {
                text: `
                    Based on the provided resume document, generate exactly 10 in-depth technical and behavioral interview questions.
                    The questions should be challenging and directly relevant to the programming languages, projects, and certifications mentioned.
                    Return the questions as a JSON array of strings. For example: ["Question 1?", "Question 2?"].
                `
            }
        ]
      },
       config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
            }
        }
       }
    });

    const jsonString = response.text.trim();
    const questions = JSON.parse(jsonString);
    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    console.error("Error generating questions from resume:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('400')) {
        return ["Could not process the uploaded file. It might be corrupted or in an unsupported format. Please try a different file (PDF, DOCX, TXT)."];
    }
    return ["Could not generate questions due to an API error. Please try again later."];
  }
};

export const evaluateAnswer = async (question: string, answer: string): Promise<{ feedback: string; score: number }> => {
    if (!isApiKeyConfigured()) {
        await demoDelay(1200);
        const randomScore = Math.floor(Math.random() * 3) + 3; // Score between 3 and 5
        return {
            feedback: "This is a solid answer. You demonstrated a good understanding of the topic. To improve, you could provide a more specific, real-world example from your experience.",
            score: randomScore
        };
    }

    const ai = getAi();
    if (!ai) return { feedback: "Could not connect to the AI service.", score: 0 };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `As a senior technical interviewer, evaluate the following answer provided for the given interview question.
            
            Question: "${question}"
            Answer: "${answer}"

            Provide constructive feedback on the answer's technical accuracy, clarity, and depth. Then, give a score from 1 to 5, where 1 is poor and 5 is excellent.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        feedback: { type: Type.STRING },
                        score: { type: Type.NUMBER }
                    },
                    required: ["feedback", "score"]
                }
            }
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);

        if (typeof result.feedback === 'string' && typeof result.score === 'number') {
            return result;
        } else {
            throw new Error("Generated data does not match evaluation format.");
        }

    } catch (error) {
        console.error(`Error evaluating answer:`, error);
        return {
            feedback: "An error occurred while evaluating the answer. Please try again.",
            score: 0
        };
    }
};

export const summarizeInterviewPerformance = async (results: { question: string; answer: string; score: number }[]): Promise<{ strengths: string; areasForImprovement: string; }> => {
    if (!isApiKeyConfigured()) {
        await demoDelay(1800);
        return {
            strengths: "You communicated your ideas clearly and showed a good grasp of the technical fundamentals discussed. Your examples were relevant and demonstrated your experience.",
            areasForImprovement: "To take your answers to the next level, focus on articulating the impact and business value of your work. Quantifying your achievements (e.g., 'improved performance by 20%') can be very powerful."
        };
    }
    
    const ai = getAi();
    if (!ai) return { strengths: "Could not connect to AI service.", areasForImprovement: "" };
    
    const performanceData = results.map(r => `Question: ${r.question}\nAnswer: ${r.answer}\nScore: ${r.score}/5`).join('\n\n');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `As an interview coach, analyze the following interview performance data.
            
            ${performanceData}

            Based on all the answers and scores, provide a high-level summary. Identify the candidate's key strengths and the main areas for improvement. Be constructive and provide actionable advice.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strengths: { type: Type.STRING, description: "A paragraph summarizing the candidate's key strengths." },
                        areasForImprovement: { type: Type.STRING, description: "A paragraph identifying the main areas for improvement with actionable advice." }
                    },
                    required: ["strengths", "areasForImprovement"]
                }
            }
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error(`Error summarizing performance:`, error);
        return {
            strengths: "An error occurred while generating the performance summary.",
            areasForImprovement: "Please review the individual feedback for each question."
        };
    }
};


export const generateMcqTest = async (subject: TechnicalSubject): Promise<MCQ[]> => {
    if (!isApiKeyConfigured()) {
        await demoDelay(1000);
        return sampleMcqs;
    }

    const ai = getAi();
    if (!ai) return [{ question: `Could not connect to the AI service.`, options: [], correctAnswer: "" }];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate 10 multiple-choice questions for a technical interview on the subject of ${subject}. Each question should have 4 options and one correct answer. Ensure the provided 'correctAnswer' is one of the strings in the 'options' array.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            },
                            correctAnswer: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctAnswer"]
                    }
                }
            }
        });
        
        const jsonString = response.text.trim();
        const mcqs = JSON.parse(jsonString);

        if (Array.isArray(mcqs) && mcqs.every(item => 'question' in item && 'options' in item && 'correctAnswer' in item)) {
            return mcqs;
        } else {
            console.error("Generated data does not match MCQ format.", mcqs);
            throw new Error("Generated data does not match MCQ format.");
        }

    } catch (error) {
        console.error(`Error generating MCQs for ${subject}:`, error);
        return [{
            question: `An error occurred while fetching questions for ${subject}. Please try again.`,
            options: [],
            correctAnswer: ""
        }];
    }
};

export const summarizeMcqPerformance = async (subject: TechnicalSubject, score: number, total: number): Promise<{ strengths: string; areasForImprovement: string; }> => {
    if (!isApiKeyConfigured()) {
        await demoDelay(1000);
        return {
            strengths: `A score of ${score}/${total} indicates a good foundational knowledge in ${subject}. You seem comfortable with the core concepts.`,
            areasForImprovement: `To deepen your understanding, focus on practical application and edge cases related to ${subject}. Consider reviewing advanced topics and recent developments in the field.`
        };
    }
    
    const ai = getAi();
    if (!ai) return { strengths: "Could not connect to AI service.", areasForImprovement: "" };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `As a technical instructor, analyze the following MCQ test score.
            
            Subject: ${subject}
            Score: ${score} out of ${total}

            Based on this score, provide a high-level summary. Identify the candidate's likely strengths and suggest areas for improvement for this specific subject. Be encouraging and provide actionable advice.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strengths: { type: Type.STRING, description: "A paragraph summarizing the candidate's likely strengths in this subject." },
                        areasForImprovement: { type: Type.STRING, description: "A paragraph identifying potential areas for improvement with actionable advice." }
                    },
                    required: ["strengths", "areasForImprovement"]
                }
            }
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error(`Error summarizing MCQ performance:`, error);
        return {
            strengths: "An error occurred while generating the performance summary.",
            areasForImprovement: "Review your answers to identify specific topics you need to work on."
        };
    }
};
