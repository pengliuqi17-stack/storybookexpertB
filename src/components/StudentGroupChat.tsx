/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  BookOpen,
  Award,
  MessageSquare,
  Users,
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  Crown,
  LogOut,
  HelpCircle,
  AtSign,
} from "lucide-react";
import { Classroom, Student, ChatMessage } from "../types.js";

interface StudentGroupChatProps {
  studentName: string;
  classroomCode: string;
  initialClassroom: Classroom;
  onExit: () => void;
}

export default function StudentGroupChat({
  studentName,
  classroomCode,
  initialClassroom,
  onExit,
}: StudentGroupChatProps) {
  // Database State sync
  const [classroom, setClassroom] = useState<Classroom>(initialClassroom);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudents, setActiveStudents] = useState<Student[]>([]);

  // Socket state
  const socketRef = useRef<Socket | null>(null);

  // UI state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [inputText, setInputText] = useState("");
  const [aiStatus, setAiStatus] = useState<{ status: string; text: string; position?: number }>({
    status: "idle",
    text: "",
  });

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizFeedbacks, setQuizFeedbacks] = useState<Record<string, string>>({});

  // XP notification state
  const [xpToast, setXpToast] = useState<{ visible: boolean; earned: boolean; amount: number; reason: string } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Chat message container auto scroll ref
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Initialize Socket.io connection on load
  useEffect(() => {
    // Establish connection to host running the server
    const socket = io();
    socketRef.current = socket;

    // Join room
    socket.emit("join_classroom", {
      classroomCode,
      username: studentName,
      role: "student",
    });

    // Listeners
    socket.on("initial_sync", ({ messages: syncedMsgs, students: syncedStudents }) => {
      setMessages(syncedMsgs);
      setStudents(syncedStudents);
    });

    socket.on("message", (newMsg: ChatMessage) => {
      setMessages((prev) => [...prev, newMsg]);
    });

    socket.on("leaderboard_update", (updatedStudents: Student[]) => {
      setStudents(updatedStudents);
    });

    socket.on("ai_status", (statusObj) => {
      setAiStatus(statusObj);
    });

    socket.on("quiz_result_feedback", ({ success, message }) => {
      // General feedback alert from socket
      console.log("Quiz outcome feedback: ", message);
    });

    socket.on("xp_result", ({ earned, amount, reason }) => {
      setXpToast({ visible: true, earned, amount, reason });
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setXpToast((prev) => prev ? { ...prev, visible: false } : null);
      }, 5000);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [classroomCode, studentName]);

  // Handle message window scroll to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, aiStatus]);

  // Find self data in synced list
  const selfStudent = students.find((s) => s.username === studentName);

  // Slide page navigate
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const nextSlide = () => {
    if (classroom.storybookPages) {
      setCurrentSlide((prev) => (prev < classroom.storybookPages.length - 1 ? prev + 1 : prev));
    }
  };

  // Submit chat message helper
  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : inputText;
    if (!text.trim() || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      text: text.trim(),
    });

    if (textToSend === undefined) {
      setInputText("");
    }
  };

  // Click pre-set Inspire prompts helper
  const handleInspireClick = (promptText: string) => {
    // Prefix with "[inspire]" so server can prioritize treating it as AI call instantly
    handleSendMessage(`[inspire] ${promptText}`);
  };

  // Answer a Quiz Question and evaluate immediately on tap for high interactivity
  const handleSelectQuizOption = (quizId: string, optionIdx: number, correctIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [quizId]: optionIdx }));

    const isCorrect = optionIdx === correctIdx;

    if (socketRef.current) {
      socketRef.current.emit("submit_quiz", {
        username: studentName,
        classroomCode,
        quizId,
        isCorrect,
      });
    }

    setQuizFeedbacks((prev) => ({
      ...prev,
      [quizId]: isCorrect
        ? "🌟 Whoopee! Correct answer (+5 points & Badge!)"
        : "❌ Nice try! Let's read slide pages carefully & retry!",
    }));
  };

  const handleSubmitQuiz = (quizId: string, correctIdx: number) => {
    const chosenIdx = selectedAnswers[quizId];
    if (chosenIdx === undefined) {
      setQuizFeedbacks((prev) => ({
        ...prev,
        [quizId]: "⚠️ Please tap one option first!",
      }));
      return;
    }

    const isCorrect = chosenIdx === correctIdx;

    if (socketRef.current) {
      socketRef.current.emit("submit_quiz", {
        username: studentName,
        classroomCode,
        quizId,
        isCorrect,
      });
    }

    setQuizFeedbacks((prev) => ({
      ...prev,
      [quizId]: isCorrect
        ? "🌟 Whoopee! Correct answer (+5 points & Badge!)"
        : "❌ Nice try! Let's read slide pages carefully & retry!",
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col h-screen selection:bg-pink-100 overflow-hidden font-sans relative">
      {/* Floating XP & Civility Feedback Toast */}
      {xpToast && xpToast.visible && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] max-w-md w-[90%] transition-all duration-300 animate-bounce ${
          xpToast.earned
            ? "bg-yellow-100 text-slate-900"
            : "bg-rose-50 text-slate-800"
        }`}>
          <div className="text-2xl flex-shrink-0">
            {xpToast.earned ? "✨" : "💡"}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-black text-xs uppercase tracking-wider mb-0.5">
              {xpToast.earned ? `XP Boost Reward! (+${xpToast.amount} XP)` : "Learning Guide Feedback"}
            </h4>
            <p className="text-[11px] sm:text-xs font-bold leading-tight">
              {xpToast.reason}
            </p>
          </div>
          <button
            onClick={() => setXpToast((prev) => prev ? { ...prev, visible: false } : null)}
            className="text-xs font-black cursor-pointer hover:bg-black/10 px-1.5 py-1 rounded-sm flex items-center justify-center border border-transparent hover:border-slate-800 transition-all font-mono self-start"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Classroom bar status */}
      <div className="bg-white border-b-4 border-slate-900 px-6 py-4 flex flex-shrink-0 items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-300 p-2.5 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <BookOpen className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{classroom.name}</h1>
            <p className="text-xs font-semibold text-slate-500">
              Welcome, <span className="text-blue-600 font-bold">{studentName}</span>! Invite Code:{" "}
              <span className="font-mono bg-slate-100 border px-1.5 py-0.5 rounded text-pink-600 font-black">
                {classroom.code}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={onExit}
          className="bg-pink-100 hover:bg-pink-200 text-pink-700 font-black px-4 py-2 rounded-xl text-xs border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1 cursor-pointer transition-all active:translate-y-0.5 active:shadow-none"
        >
          <LogOut className="w-3.5 h-3.5" /> Disconnect Class
        </button>
      </div>

      {/* Main split-view workspace area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Storybook top & Quiz bottom */}
        <div className="w-[35%] min-w-[320px] max-w-[430px] flex flex-col border-r-4 border-slate-900 bg-slate-100/50 p-4 gap-4 overflow-y-auto">
          {/* TOP Storybook card */}
          <div className="bg-white rounded-2xl border-4 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] p-4 flex flex-col flex-shrink-0 min-h-[480px]">
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100 mb-3">
              <span className="font-black text-slate-900 text-xs flex items-center gap-1 tracking-wide uppercase">
                📖 Storybook Slide
              </span>
              <span className="text-xs font-bold text-blue-600 font-sans">
                Page {currentSlide + 1} of{" "}
                {classroom.storybookPages ? classroom.storybookPages.length : 1}
              </span>
            </div>

            {/* Title / Pages */}
            <h3 className="font-black text-slate-800 text-base mb-2">
              {classroom.storybookTitle}
            </h3>

            {/* Illustration page preview */}
            <div className="flex-1 bg-slate-50 rounded-xl border-2 border-slate-200/80 p-2 overflow-hidden flex flex-col items-center justify-center min-h-[300px] relative mb-3">
              {classroom.storybookImages && classroom.storybookImages[currentSlide] ? (
                classroom.storybookImages[currentSlide].startsWith("data:application/pdf") ? (
                  <div className="w-full h-full flex flex-col gap-2">
                    <div className="flex items-center justify-between bg-rose-50 border border-rose-300 p-2 rounded-lg">
                      <span className="text-[11px] font-black text-rose-800 flex items-center gap-1">
                        📄 MATERIAL (PDF VIEW)
                      </span>
                      <a
                        href={classroom.storybookImages[currentSlide]}
                        download={`${classroom.storybookTitle || "classroom-material"}-page-${currentSlide + 1}.pdf`}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[9px] px-2.5 py-1 rounded border border-rose-700 shadow-sm transition-all cursor-pointer"
                      >
                        Download PDF
                      </a>
                    </div>
                    <iframe
                      src={`${classroom.storybookImages[currentSlide]}#toolbar=1`}
                      className="w-full flex-1 min-h-[220px] h-[220px] rounded-lg border-2 border-slate-300 bg-white"
                      title="PDF Material Viewer"
                    />
                  </div>
                ) : (
                  <img
                    src={classroom.storybookImages[currentSlide]}
                    referrerPolicy="no-referrer"
                    alt="Storybook scene illustration drawing"
                    className="w-full h-44 object-contain rounded-lg border border-slate-200 bg-white"
                  />
                )
              ) : (
                <div className="text-slate-300 font-mono text-[9px]">Scene Illustration Placeholder</div>
              )}
              <div className="text-slate-700 font-bold text-sm text-center leading-relaxed mt-3 px-1 overflow-y-auto max-h-[105px]">
                {classroom.storybookPages ? classroom.storybookPages[currentSlide] : ""}
              </div>
            </div>

            {/* Carousel navigation controls button */}
            <div className="flex justify-between items-center bg-slate-50 border p-2 rounded-xl">
              <button
                onClick={prevSlide}
                disabled={currentSlide === 0}
                className="bg-white border-2 border-slate-900 hover:bg-slate-100 disabled:opacity-40 text-xs font-bold px-2 py-1.5 rounded-lg text-slate-800 flex items-center cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back Slide
              </button>
              <button
                onClick={nextSlide}
                disabled={
                  !classroom.storybookPages ||
                  currentSlide === classroom.storybookPages.length - 1
                }
                className="bg-white border-2 border-slate-900 hover:bg-slate-100 disabled:opacity-40 text-xs font-bold px-2 py-1.5 rounded-lg text-slate-800 flex items-center cursor-pointer"
              >
                Next Slide <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* BOTTOM Quiz card */}
          <div className="bg-white rounded-2xl border-4 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] p-4 flex flex-col flex-shrink-0 min-h-[320px]">
            <div className="flex items-center gap-1 pb-2 border-b-2 border-slate-100 mb-3 font-black text-slate-900 text-xs tracking-wide uppercase">
              <Award className="w-4 h-4 text-pink-500 animate-pulse" /> Interactive Quizzes
            </div>

            {classroom.quizzes && classroom.quizzes.length > 0 ? (
              <div className="space-y-5">
                {classroom.quizzes.map((q, idx) => {
                  const solved = selfStudent?.badges.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        solved
                          ? "bg-emerald-50 border-emerald-300"
                          : "bg-slate-50 border-slate-350"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-dashed border-slate-200 mb-2">
                        <span className="font-bold text-xs text-slate-700">
                          Quiz Question {idx + 1}
                        </span>
                        {solved && (
                          <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] px-2 py-0.5 rounded border border-emerald-400">
                            ⭐ Solve Badge Earned!
                          </span>
                        )}
                      </div>

                      <p className="font-black text-xs text-slate-800 leading-relaxed mb-2.5">
                        {q.question}
                      </p>

                      <div className="space-y-1.5">
                        {q.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            onClick={() => handleSelectQuizOption(q.id, oIdx, q.correctAnswer)}
                            disabled={solved}
                            className={`w-full text-left p-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer ${
                              selectedAnswers[q.id] === oIdx
                                ? "bg-blue-100 border-blue-500 text-blue-900"
                                : "bg-white hover:bg-slate-100 border-slate-250 text-slate-700"
                            }`}
                          >
                            <span className="bg-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span>{opt}</span>
                          </button>
                        ))}
                      </div>

                      {/* Display feedback status alerts */}
                      {quizFeedbacks[q.id] && (
                        <div className="text-[10px] font-black mt-2 text-slate-700">
                          {quizFeedbacks[q.id]}
                        </div>
                      )}

                      {!solved && (
                        <button
                          type="button"
                          onClick={() => handleSubmitQuiz(q.id, q.correctAnswer)}
                          className="mt-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          Submit Quiz Answer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-400 text-center py-6 text-xs font-medium">
                No Quizzes added to this classroom yet.
              </div>
            )}
          </div>
        </div>

        {/* Center/Right columns: Group Chat and Leaderboard split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Chat Box column */}
          <div className="flex-1 flex flex-col bg-white h-full relative">
            {/* Scrollable messages chat room body */}
            <div id="student-chat-messages" className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="bg-blue-50 p-4 rounded-full border border-blue-200 mb-2">
                    <MessageSquare className="w-10 h-10 text-blue-400" />
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm">Silent Classroom Co-Working!</h4>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed mt-1">
                    No chats yet. Write a greeting or click one of the yellow Inspire Cards below to prompt dialogue with {classroom.agentName}!
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isSelf = m.sender === studentName;
                  const isSystem = m.role === "system";
                  const isAi = m.role === "ai";

                  if (isSystem) {
                    return (
                      <div key={m.id} className="flex justify-center my-1.5 animate-fade-in">
                        <span className="bg-blue-50 text-blue-700 px-3.5 py-1 rounded-full border border-blue-200 text-[10px] sm:text-xs font-bold leading-normal">
                          {m.text}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex gap-2.5 max-w-[85%] ${
                        isSelf ? "ml-auto flex-row-reverse" : "mr-auto"
                      } animate-fade-in`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 mt-1">
                        {isAi ? (
                          <img
                            src={classroom.agentImage}
                            referrerPolicy="no-referrer"
                            alt="AI Agent face avatar icon"
                            className="w-8.5 h-8.5 rounded-full border-2 border-slate-950 object-cover"
                          />
                        ) : (
                          <div
                            className={`w-8.5 h-8.5 rounded-full border-2 border-slate-950 flex items-center justify-center font-black text-xs ${
                              isSelf ? "bg-blue-300" : "bg-pink-300"
                            }`}
                          >
                            {m.sender.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Msg text bubble details */}
                      <div>
                        <div
                          onClick={() => {
                            if (!isSelf && !isAi) {
                              setInputText((prev) => `@${m.sender} ${prev}`);
                            }
                          }}
                          className={`text-[10px] font-bold mb-0.5 text-slate-500 flex items-center gap-1 group/reply ${
                            isSelf ? "text-right justify-end" : "cursor-pointer hover:text-blue-600"
                          }`}
                          title={!isSelf && !isAi ? `Reply to ${m.sender}` : undefined}
                        >
                          <span>{m.sender}</span>
                          {isAi && (
                            <span className="bg-yellow-100 text-yellow-800 text-[8px] font-black border border-yellow-300 rounded px-1 ml-0.5 uppercase">
                              Agent
                            </span>
                          )}
                          {!isSelf && !isAi && (
                            <span className="text-[8px] text-blue-500 opacity-0 group-hover/reply:opacity-100 transition-opacity font-bold">
                              (Reply ↩)
                            </span>
                          )}
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-sm border-2 border-slate-900 leading-relaxed font-medium shadow-[1.5px_1.5px_0px_rgba(15,23,42,1)] ${
                            isSelf
                              ? "bg-blue-100 text-slate-900 rounded-tr-none"
                              : isAi
                              ? "bg-yellow-100 text-slate-900 rounded-tl-none font-bold"
                              : "bg-white text-slate-800 rounded-tl-none"
                          }`}
                        >
                          {m.text.startsWith("[inspire]") ? (
                            <span>
                              <span className="text-pink-500 font-extrabold mr-1">[Prompted Card]</span>
                              {m.text.replace("[inspire]", "").trim()}
                            </span>
                          ) : (
                            m.text
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Real-time AI processing status indicator */}
              {aiStatus.status !== "idle" && (
                <div className="flex gap-2.5 max-w-[80%] mr-auto animate-pulse">
                  <div className="flex-shrink-0 mt-1">
                    <img
                      src={classroom.agentImage}
                      referrerPolicy="no-referrer"
                      alt="AI thinking bot"
                      className="w-8.5 h-8.5 rounded-full border-2 border-slate-950 object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold mb-0.5 text-yellow-600 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-yellow-500 animate-spin" /> {classroom.agentName} is thinking
                    </div>
                    <div className="p-3 bg-yellow-50 border-2 border-dashed border-yellow-400 text-xs font-bold rounded-2xl rounded-tl-none text-yellow-800">
                      {aiStatus.text}
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Inspire Cards selection board zone */}
            <div className="px-4 py-2 border-t border-slate-200 bg-white flex-shrink-0">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1 pb-1 border-b border-dashed">
                💡 Tap to Ask {classroom.agentName}:
              </div>
              <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
                {classroom.inspireCards && classroom.inspireCards.length > 0 ? (
                  classroom.inspireCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => handleInspireClick(card.text)}
                      className="flex-shrink-0 bg-yellow-100 hover:bg-yellow-250 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_rgba(15,23,42,1)] px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-800 flex items-center gap-1 cursor-pointer transition-all active:translate-y-0.5 active:shadow-none"
                    >
                      ⚡ {card.text}
                    </button>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium font-sans">No prompts loaded.</span>
                )}
              </div>
            </div>

            {/* Quick Mentions & Peer Collaboration Board */}
            <div className="px-4 py-2 bg-slate-100/50 flex flex-wrap items-center gap-2 border-t-2 border-slate-300 justify-between">
              <div className="flex flex-wrap items-center gap-1.5 animate-fade-in">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1 bg-slate-200 px-2 py-0.5 rounded-md border border-slate-300 shadow-sm font-mono">
                  <AtSign className="w-3 h-3 text-slate-600" /> Mention:
                </span>
                
                {/* Agent Tag Button */}
                <button
                  type="button"
                  onClick={() => {
                    setInputText((prev) => {
                      const tag = `@${classroom.agentName} `;
                      return prev.includes(tag) ? prev : tag + prev;
                    });
                    document.getElementById("message-input")?.focus();
                  }}
                  className="bg-yellow-100 hover:bg-yellow-250 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_rgba(15,23,42,1)] active:translate-y-px active:shadow-none text-slate-950 font-black text-[10.5px] px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  title={`Click to mention ${classroom.agentName}`}
                >
                  {classroom.agentImage ? (
                    <img
                      src={classroom.agentImage}
                      alt="Agent Avatar"
                      className="w-4 h-4 rounded-full border border-slate-950 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>🤖</span>
                  )}
                  <span>@{classroom.agentName}</span>
                </button>

                {/* peer classmates tags */}
                {students.filter(st => st.username !== studentName).length > 0 ? (
                  students
                    .filter(st => st.username !== studentName)
                    .slice(0, 3)
                    .map((st) => (
                      <button
                        key={st.username}
                        type="button"
                        onClick={() => {
                          setInputText((prev) => {
                            const tag = `@${st.username} `;
                            return prev.includes(tag) ? prev : prev + " " + tag;
                          });
                          document.getElementById("message-input")?.focus();
                        }}
                        className="bg-blue-50 hover:bg-blue-100 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_rgba(15,23,42,1)] active:translate-y-px active:shadow-none text-slate-900 font-extrabold text-[10.5px] px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                        title={`Mention and talk to ${st.username}`}
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>@{st.username}</span>
                      </button>
                    ))
                ) : (
                  <span className="text-[10px] text-slate-500 font-bold italic ml-1">
                    Wait for classmates to join...
                  </span>
                )}
              </div>

              <div className="text-[9.5px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">
                💬 Mention peers to cooperate &amp; earn <span className="text-emerald-600 font-black">+5 XP</span>!
              </div>
            </div>

            {/* User typing textbox dock bar */}
            <div className="p-3 border-t-4 border-slate-900 bg-slate-100/30 flex-shrink-0 flex items-center gap-2">
              <input
                id="message-input"
                type="text"
                placeholder={`Ask ${classroom.agentName} questions or talk with classmates! Use '?' to invoke the robot`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                className="flex-1 bg-white px-4 py-3 border-3 border-slate-900 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-sm"
              />
              <button
                id="btn-send-message"
                onClick={() => handleSendMessage()}
                className="bg-yellow-300 hover:bg-yellow-400 text-slate-950 p-3 rounded-xl border-3 border-slate-900 shadow-[2px_2px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none cursor-pointer"
              >
                <Send className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          {/* Far-Right Column: Leaderboard metrics */}
          <div className="w-[200px] border-l-4 border-slate-900 bg-white p-4 flex flex-col h-full overflow-y-auto">
            <h3 className="font-black text-xs text-slate-800 tracking-wider uppercase flex items-center gap-1.5 pb-2 border-b-2 mb-3">
              <Crown className="w-4 h-4 text-yellow-500 animate-pulse" /> Class Leaderboard
            </h3>

            {students.length === 0 ? (
              <div className="text-[11px] text-slate-400 font-medium py-10 text-center uppercase">
                Loading students ranks...
              </div>
            ) : (
              <div className="space-y-3.5">
                {students
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .map((st, index) => {
                    const isSelf = st.username === studentName;
                    return (
                      <div
                        key={st.username}
                        className={`p-2 rounded-xl border-2 transition-all flex flex-col gap-1.5 ${
                          isSelf
                            ? "bg-blue-50 border-blue-500 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                            : "bg-slate-50 border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-800 truncate max-w-[110px]" title={st.username}>
                            {index === 0 && st.score > 0 ? "🥇 " : ""}
                            {index === 1 && st.score > 0 ? "🥈 " : ""}
                            {st.username}
                          </span>
                          <span className="font-extrabold text-[11px] text-zinc-900">
                            {st.score} XP
                          </span>
                        </div>

                        {/* Badges list */}
                        {st.badges && st.badges.length > 0 ? (
                          <div className="flex flex-wrap gap-1 border-t pt-1 border-slate-200">
                            {st.badges.map((b) => (
                              <span
                                key={b}
                                className="bg-yellow-100 text-[9px] font-bold px-1 py-0.5 rounded border border-yellow-300 leading-none"
                                title={`Solved Quiz Question #${b.replace("q", "")}`}
                              >
                                🏆
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-medium">No Badges yet</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
