/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QuizQuestion {
  id: string; // e.g. "q1", "q2"
  question: string;
  options: string[];
  correctAnswer: number; // Index element of options (0-indexed)
}

export interface InspireCard {
  id: string;
  text: string;
}

export interface Classroom {
  code: string; // generated Classroom Invite Code (e.g., "AI-5012")
  name: string;
  agentName: string;
  agentPrompt: string;
  agentImage: string; // Base64 data-URL or placeholder illustration URL
  storybookTitle: string;
  storybookPages: string[]; // Content of each page of the story (markdown or text)
  storybookImages: string[]; // Corresponding Base64 or illustration preview URLs for each page (matching pages index)
  quizzes: QuizQuestion[];
  inspireCards: InspireCard[];
  createdAt: string;
}

export interface Student {
  username: string; // Combined Class number/name e.g. "Jack-03" or "Cindy-12"
  classroomCode: string;
  score: number;
  badges: string[]; // Array of quiz question IDs correctly answered
  joinedAt: string;
}

export interface ChatMessage {
  id: string;
  classroomCode: string;
  sender: string; // Username, AgentName, "System", or "Teacher"
  role: "student" | "teacher" | "ai" | "system";
  text: string;
  timestamp: string;
  mediaUrl?: string; // Optional image or video link
}

export interface ClassroomStats {
  classAverage: number;
  totalStudents: number;
  studentList: {
    username: string;
    score: number;
    badgesCount: number;
  }[];
}
