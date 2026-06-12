/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import LoginScreen from "./components/LoginScreen.tsx";
import TeacherDashboard from "./components/TeacherDashboard.tsx";
import StudentGroupChat from "./components/StudentGroupChat.tsx";
import { Classroom } from "./types.ts";

export default function App() {
  const [viewState, setViewState] = useState<"login" | "student_chat" | "teacher_dashboard">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticated participant sessions
  const [studentName, setStudentName] = useState("");
  const [classroomCode, setClassroomCode] = useState("");
  const [activeClassroom, setActiveClassroom] = useState<Classroom | null>(null);

  const handleStudentLoginSubmit = async (username: string, inviteCode: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/students/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          classroomCode: inviteCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not join that classroom. Please try again!");
      }

      // Success
      setStudentName(data.student.username);
      setClassroomCode(data.student.classroomCode);
      setActiveClassroom(data.classroom);
      setViewState("student_chat");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Let's check with your teacher!");
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLoginSubmit = (accountName: string) => {
    setViewState("teacher_dashboard");
  };

  const handleExitToLogin = () => {
    setStudentName("");
    setClassroomCode("");
    setActiveClassroom(null);
    setViewState("login");
    setError(null);
  };

  return (
    <div id="app-root-container">
      {viewState === "login" && (
        <LoginScreen
          onStudentLogin={handleStudentLoginSubmit}
          onTeacherLogin={handleTeacherLoginSubmit}
          loading={loading}
          error={error}
        />
      )}

      {viewState === "teacher_dashboard" && (
        <TeacherDashboard onLogout={handleExitToLogin} />
      )}

      {viewState === "student_chat" && activeClassroom && (
        <StudentGroupChat
          studentName={studentName}
          classroomCode={classroomCode}
          initialClassroom={activeClassroom}
          onExit={handleExitToLogin}
        />
      )}
    </div>
  );
}
