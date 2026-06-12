/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BookOpen, Users, LogIn, Sparkles, ShieldCheck } from "lucide-react";

interface LoginScreenProps {
  onStudentLogin: (username: string, inviteCode: string) => Promise<void>;
  onTeacherLogin: (accountName: string) => void;
  loading: boolean;
  error: string | null;
}

export default function LoginScreen({
  onStudentLogin,
  onTeacherLogin,
  loading,
  error,
}: LoginScreenProps) {
  const [role, setRole] = useState<"none" | "student" | "teacher">("none");
  const [username, setUsername] = useState("");
  const [classroomCode, setClassroomCode] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!username.trim()) {
      setValidationError("Please enter your name first!");
      return;
    }
    if (!classroomCode.trim()) {
      setValidationError("Please enter the special Classroom Code!");
      return;
    }

    // Suggested standard format for primary kids: "Name-ClassNum" or just free text.
    onStudentLogin(username.trim(), classroomCode.trim().toUpperCase());
  };

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (teacherName.trim().toLowerCase() !== "peng liuqi") {
      setValidationError("Permission denied. Only Mr. Peng Liuqi can open the dashboard!");
      return;
    }

    onTeacherLogin(teacherName.trim());
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-pink-200">
      <div className="w-full max-w-xl bg-white rounded-3xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden">
        {/* Header decoration */}
        <div className="bg-yellow-300 border-b-4 border-slate-900 p-6 text-center relative overflow-hidden">
          <div className="absolute top-2 left-4 text-slate-800 text-3xl font-bold opacity-30 select-none">
            🤖 ⭐
          </div>
          <div className="absolute bottom-2 right-4 text-slate-800 text-3xl font-bold opacity-30 select-none">
            📚 ✨
          </div>
          <div className="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border-2 border-slate-900 text-xs font-bold text-pink-500 uppercase tracking-wide shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <Sparkles className="w-3.5 h-3.5 animate-spin" /> AI Learning Playground
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {role === "none" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student choice card */}
                <button
                  id="btn-student-role"
                  onClick={() => {
                    setRole("student");
                    setValidationError(null);
                  }}
                  className="group bg-blue-100 hover:bg-blue-200 text-slate-900 p-6 rounded-2xl border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-1 active:shadow-none transition-all flex flex-col items-center text-center gap-3 cursor-pointer"
                >
                  <div className="bg-white p-4 rounded-full border-2 border-slate-900 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <span className="block font-black text-xl">I am a Student</span>
                  </div>
                </button>

                {/* Teacher choice card */}
                <button
                  id="btn-teacher-role"
                  onClick={() => {
                    setRole("teacher");
                    setValidationError(null);
                  }}
                  className="group bg-pink-100 hover:bg-pink-200 text-slate-900 p-6 rounded-2xl border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-1 active:shadow-none transition-all flex flex-col items-center text-center gap-3 cursor-pointer"
                >
                  <div className="bg-white p-4 rounded-full border-2 border-slate-900 group-hover:scale-110 transition-transform">
                    <Users className="w-8 h-8 text-pink-500" />
                  </div>
                  <div>
                    <span className="block font-black text-xl">I am a Teacher</span>
                  </div>
                </button>
              </div>
            </div>
          ) : role === "student" ? (
            /* Student Form */
            <form onSubmit={handleStudentSubmit} className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
                <span className="font-bold text-blue-600 text-base">👦 Student Entrance</span>
                <button
                  type="button"
                  onClick={() => setRole("none")}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Back
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Choose your Name or Class Number:
                </label>
                <input
                  id="student-username-input"
                  type="text"
                  placeholder="e.g. Jack-03 or Cindy"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-3 border-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
                <span className="text-xs text-slate-500 mt-1 block font-medium">
                  Use any name. No email or password needed!
                </span>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Type the Classroom Invite Code:
                </label>
                <input
                  id="student-code-input"
                  type="text"
                  placeholder="e.g. ETHICS-101"
                  value={classroomCode}
                  onChange={(e) => setClassroomCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-3 border-slate-900 font-mono font-bold focus:outline-none focus:ring-4 focus:ring-blue-100 uppercase"
                />
              </div>

              {validationError && (
                <div className="p-3 bg-red-50 rounded-xl border-2 border-red-300 text-red-600 font-bold text-xs flex items-center gap-2">
                  <span>⚠️</span> {validationError}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 rounded-xl border-2 border-red-300 text-red-600 font-bold text-xs flex items-center gap-2">
                  <span>⚠️</span> {error}
                </div>
              )}

              <button
                id="btn-student-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-blue-400 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-5 h-5" />
                {loading ? "Letting you in..." : "Enter Group Classroom Chat!"}
              </button>
            </form>
          ) : (
            /* Teacher Form */
            <form onSubmit={handleTeacherSubmit} className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
                <span className="font-bold text-pink-600 text-base">👩‍🏫 Teacher Office</span>
                <button
                  type="button"
                  onClick={() => setRole("none")}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Back
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Authorized Teacher Account Name:
                </label>
                <input
                  id="teacher-name-input"
                  type="text"
                  placeholder="Enter full teacher authorization name"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-3 border-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-pink-100"
                />
                <span className="text-xs text-rose-500 font-semibold mt-1 block">
                  🔐 Hint: System requires exactly &quot;Peng Liuqi&quot; to authorize login!
                </span>
              </div>

              {validationError && (
                <div className="p-3 bg-red-50 rounded-xl border-2 border-red-300 text-red-600 font-bold text-xs flex items-center gap-2">
                  <span>⚠️</span> {validationError}
                </div>
              )}

              <button
                id="btn-teacher-submit"
                type="submit"
                className="w-full bg-pink-400 hover:bg-pink-500 text-white font-black py-4 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5" />
                Open Teacher Dashboard
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
