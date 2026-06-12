/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Plus,
  BookOpen,
  Sparkles,
  Award,
  ChevronLeft,
  Users,
  Eye,
  CheckCircle2,
  Trash2,
  Bookmark,
  Share2,
} from "lucide-react";
import { Classroom, QuizQuestion, InspireCard } from "../types.js";

interface TeacherDashboardProps {
  onLogout: () => void;
}

export default function TeacherDashboard({ onLogout }: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<"create" | "monitor">("create");
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  // Classroom creation state parameters
  const [className, setClassName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentImageSelected, setAgentImageSelected] = useState(
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=200"
  );
  
  // Custom pages
  const [storybookTitle, setStorybookTitle] = useState("");
  const [storybookPages, setStorybookPages] = useState<string[]>([""]);
  const [storybookImages, setStorybookImages] = useState<string[]>([""]);

  // Quizzes Creation
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([
    {
      id: "q1",
      question: "",
      options: ["", "", ""],
      correctAnswer: 0,
    },
  ]);

  // Inspire cards
  const [inspireCards, setInspireCards] = useState<InspireCard[]>([
    { id: "i1", text: "What is AI?" },
  ]);

  // Monitoring active states
  const [selectedMonitorCode, setSelectedMonitorCode] = useState<string>("");
  const [monitoringStats, setMonitoringStats] = useState<any>(null);
  const [monitoringMessages, setMonitoringMessages] = useState<any[]>([]);

  // Preset robot image choices for design simplicity
  const robotPresets = [
    { Name: "Gentle Blue", Url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=200" },
    { Name: "Creative Paint", Url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200" },
    { Name: "Cozy Orange", Url: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&q=80&w=200" },
    { Name: "Dotted Cyber", Url: "https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&q=80&w=200" },
  ];

  // Load classrooms on component mount or monitoring switch
  useEffect(() => {
    fetchClassrooms();
  }, [activeTab]);

  const fetchClassrooms = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/classrooms");
      const list = await res.json();
      setClassrooms(list);
      if (list.length > 0 && !selectedMonitorCode) {
        setSelectedMonitorCode(list[0].code);
      }
    } catch (err: any) {
      setError("Failed to fetch classrooms: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll database content for real-time monitoring stats
  useEffect(() => {
    if (activeTab === "monitor" && selectedMonitorCode) {
      const fetchStats = async () => {
        try {
          const statsRes = await fetch(`/api/classrooms/${selectedMonitorCode}/stats`);
          const sData = await statsRes.json();
          setMonitoringStats(sData);

          // Connect directly to get messages too
          const msgRes = await fetch(`/api/classrooms/${selectedMonitorCode}`);
          const cData = await msgRes.json();
          // Fetch historical message lists
          const mockWsMessagesRes = await fetch(`/api/students/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "SystemCheck", classroomCode: selectedMonitorCode }),
          });
          const checkRes = await mockWsMessagesRes.json();
          // We can query classroom via WS or standard REST backdoors
          setMonitoringMessages(cData.messages || []);
        } catch (err) {
          console.error("Stats fetching loop failure:", err);
        }
      };

      fetchStats();
      const interval = setInterval(fetchStats, 6000);
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedMonitorCode]);

  // Storybook page handlers
  const addStoryPage = () => {
    setStorybookPages([...storybookPages, ""]);
    setStorybookImages([...storybookImages, ""]);
  };

  const removeStoryPage = (idx: number) => {
    if (storybookPages.length === 1) return;
    setStorybookPages(storybookPages.filter((_, i) => i !== idx));
    setStorybookImages(storybookImages.filter((_, i) => i !== idx));
  };

  const handlePageChange = (val: string, idx: number) => {
    const updated = [...storybookPages];
    updated[idx] = val;
    setStorybookPages(updated);
  };

  const handlePageImageChange = (val: string, idx: number) => {
    const updated = [...storybookImages];
    updated[idx] = val;
    setStorybookImages(updated);
  };

  const [dragActiveStates, setDragActiveStates] = useState<Record<number, boolean>>({});

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveStates((prev) => ({ ...prev, [idx]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveStates((prev) => ({ ...prev, [idx]: false }));
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveStates((prev) => ({ ...prev, [idx]: false }));
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file, idx);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, idx);
    }
  };

  const processFile = (file: File, idx: number) => {
    if (
      file.type !== "image/png" &&
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".png") &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PNG illustration images and PDF documents can be uploaded!");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      handlePageImageChange(result, idx);
    };
    reader.onerror = () => {
      setError("Failed to read the selected file.");
    };
    reader.readAsDataURL(file);
  };

  const [agentDragActive, setAgentDragActive] = useState(false);

  const handleAgentDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAgentDragActive(true);
  };

  const handleAgentDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAgentDragActive(false);
  };

  const handleAgentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAgentDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAgentFile(file);
    }
  };

  const handleAgentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAgentFile(file);
    }
  };

  const processAgentFile = (file: File) => {
    if (
      !file.type.startsWith("image/") &&
      !file.name.toLowerCase().endsWith(".png") &&
      !file.name.toLowerCase().endsWith(".jpg") &&
      !file.name.toLowerCase().endsWith(".jpeg")
    ) {
      setError("Only PNG or JPG illustration images can be uploaded as an AI Avatar!");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAgentImageSelected(result);
    };
    reader.onerror = () => {
      setError("Failed to read the selected file.");
    };
    reader.readAsDataURL(file);
  };

  // Quizzes handlers
  const addQuiz = () => {
    const newId = `q${quizzes.length + 1}`;
    setQuizzes([...quizzes, { id: newId, question: "", options: ["", "", ""], correctAnswer: 0 }]);
  };

  const removeQuiz = (idx: number) => {
    if (quizzes.length === 1) return;
    setQuizzes(quizzes.filter((_, i) => i !== idx));
  };

  const updateQuiz = (fields: Partial<QuizQuestion>, idx: number) => {
    const updated = [...quizzes];
    updated[idx] = { ...updated[idx], ...fields };
    setQuizzes(updated);
  };

  const updateQuizOption = (val: string, qIdx: number, oIdx: number) => {
    const updated = [...quizzes];
    const opts = [...updated[qIdx].options];
    opts[oIdx] = val;
    updated[qIdx].options = opts;
    setQuizzes(updated);
  };

  // Inspire Cards handlers
  const addInspireCard = () => {
    const newId = `i${inspireCards.length + 1}`;
    setInspireCards([...inspireCards, { id: newId, text: "" }]);
  };

  const removeInspireCard = (idx: number) => {
    if (inspireCards.length === 1) return;
    setInspireCards(inspireCards.filter((_, i) => i !== idx));
  };

  const handleInspireChange = (val: string, idx: number) => {
    const updated = [...inspireCards];
    updated[idx].text = val;
    setInspireCards(updated);
  };

  // Submit new classroom
  const handleSaveClassroom = async () => {
    setError(null);
    setSuccessCode(null);

    if (!className.trim()) {
      setError("Please write the Classroom Name first!");
      return;
    }
    if (!agentName.trim()) {
      setError("Please specify the AI Assistant Name!");
      return;
    }
    if (!agentPrompt.trim()) {
      setError("Please outline the System Instruction Prompt to guide the Agent's behavior!");
      return;
    }
    if (!storybookTitle.trim()) {
      setError("Please define the Storybook Title!");
      return;
    }

    // Validate empty pages
    if (storybookPages.some((p) => !p.trim())) {
      setError("Please make sure all storybook pages have descriptions written.");
      return;
    }

    // Validate quizzes
    for (let i = 0; i < quizzes.length; i++) {
      const q = quizzes[i];
      if (!q.question.trim()) {
        setError(`Please fill in the question for Quiz #${i + 1}`);
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        setError(`Please fill in all options for Quiz #${i + 1}`);
        return;
      }
    }

    // Validate inspire cards
    if (inspireCards.some((c) => !c.text.trim())) {
      setError("Please make sure all Inspire Cards have helper texts specified.");
      return;
    }

    // Prepare payload
    const payload = {
      name: className,
      agentName,
      agentPrompt,
      agentImage: agentImageSelected,
      storybookTitle,
      storybookPages,
      storybookImages,
      quizzes,
      inspireCards,
    };

    setLoading(true);
    try {
      const res = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create classroom.");
      }

      setSuccessCode(data.code);
      // Reset form options
      setClassName("");
      setAgentName("");
      setAgentPrompt("");
      setStorybookTitle("");
      setStorybookPages([""]);
      setStorybookImages([""]);
      setQuizzes([{ id: "q1", question: "", options: ["", "", ""], correctAnswer: 0 }]);
      setInspireCards([{ id: "i1", text: "" }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 selection:bg-pink-100 pb-20">
      {/* Top Bar */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-4 border-slate-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] mb-8">
        <div>
          <div className="flex items-center gap-2 text-pink-500 font-extrabold text-sm uppercase tracking-wide">
            <Bookmark className="w-4 h-4" /> Teacher Desk Portal
          </div>
          <h1 className="text-2xl font-black text-slate-900">Welcome back, Mr. Peng Liuqi!</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Create educational environments and inspect children activities in real-time.
          </p>
        </div>
        <button
          onClick={onLogout}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black px-4 py-2 text-xs rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
        >
          Disconnect / Exit
        </button>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto flex gap-4 mb-6">
        <button
          id="tab-btn-create"
          onClick={() => setActiveTab("create")}
          className={`px-5 py-3 rounded-xl border-3 border-slate-900 font-black text-sm flex items-center gap-2 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer transition-all ${
            activeTab === "create"
              ? "bg-yellow-300 text-slate-900 -translate-y-0.5"
              : "bg-white text-slate-700 hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
          }`}
        >
          <Plus className="w-4 h-4" /> Create a Classroom
        </button>
        <button
          id="tab-btn-monitor"
          onClick={() => {
            setActiveTab("monitor");
            fetchClassrooms();
          }}
          className={`px-5 py-3 rounded-xl border-3 border-slate-900 font-black text-sm flex items-center gap-2 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer transition-all ${
            activeTab === "monitor"
              ? "bg-blue-300 text-slate-900 -translate-y-0.5"
              : "bg-white text-slate-700 hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
          }`}
        >
          <Users className="w-4 h-4" /> Classroom Monitoring ({classrooms.length})
        </button>
      </div>

      {/* Main container */}
      <div className="max-w-6xl mx-auto">
        {/* Success code generation alert */}
        {successCode && (
          <div className="bg-emerald-50 border-4 border-emerald-500 rounded-2xl p-6 mb-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] animate-bounce text-emerald-800">
            <h3 className="text-lg font-black flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" /> Classroom Created Successfully!
            </h3>
            <p className="text-sm font-bold mt-1">
              Give this Invite Code to your students so they can join the classroom:
            </p>
            <div className="mt-3 inline-flex items-center gap-3 bg-white px-6 py-3 border-3 border-emerald-500 rounded-xl">
              <span className="font-mono text-3xl font-black text-emerald-700 tracking-wider">
                {successCode}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(successCode)}
                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-1.5 rounded border border-emerald-600 cursor-pointer"
              >
                Copy Code
              </button>
            </div>
            <p className="text-xs font-semibold text-emerald-600 mt-2">
              (It is automatically saved! Students can join instantly via the landing login screen.)
            </p>
          </div>
        )}

        {/* Form Errors */}
        {error && (
          <div className="bg-rose-50 border-3 border-rose-900 rounded-xl p-4 mb-6 text-rose-700 font-bold text-sm">
            ⚠️ Error: {error}
          </div>
        )}

        {activeTab === "create" ? (
          /* TAB 1: CREATE CLASSROOM FORM */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col - Config parameters */}
            <div className="lg:col-span-2 space-y-6">
              {/* SECTION 1: Classroom Name */}
              <div className="bg-white border-4 border-slate-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <legend className="text-pink-500 font-black text-sm uppercase tracking-wider mb-2">
                  Section 1 — Classroom Name
                </legend>
                <h3 className="text-lg font-black text-slate-800 mb-3">Group Room Title</h3>
                <input
                  id="input-class-name"
                  type="text"
                  placeholder="e.g. Grade 3B AI Ethics Discussion Room"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-3 border-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-100"
                />
              </div>

              {/* SECTION 2: Design AI Agent */}
              <div className="bg-white border-4 border-slate-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <legend className="text-yellow-600 font-black text-sm uppercase tracking-wider mb-2">
                  Section 2 — Custom AI Agent Design (Fully Manual)
                </legend>
                <h3 className="text-lg font-black text-slate-800 mb-2">Build your Agent Personae</h3>
                <p className="text-xs font-semibold text-slate-500 mb-4 bg-yellow-50 p-2.5 rounded-lg border border-yellow-200">
                  ⚠️ Note: Manual setup required. Type the name and upload the icon below. The system does not write prompt templates for you.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agent Name:
                    </label>
                    <input
                      id="input-agent-name"
                      type="text"
                      placeholder="e.g. Robot Buddy, EthicsBot"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border-3 border-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Upload Agent Avatar Picture (PNG/JPG):
                    </label>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
                      {/* Avatar Circle Preview */}
                      <div className="relative group">
                        {agentImageSelected ? (
                          <div className="relative w-18 h-18 rounded-full border-3 border-slate-900 overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] bg-white flex-shrink-0">
                            <img
                              src={agentImageSelected}
                              alt="Custom agent avatar preview"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setAgentImageSelected("")}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white text-[10px] font-black cursor-pointer uppercase"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="w-18 h-18 rounded-full border-3 border-dashed border-slate-400 bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold flex-shrink-0 font-mono">
                            No Icon
                          </div>
                        )}
                      </div>

                      {/* Dropzone & file selector */}
                      <div className="flex-1 w-full">
                        <div
                          onDragOver={handleAgentDragOver}
                          onDragLeave={handleAgentDragLeave}
                          onDrop={handleAgentDrop}
                          onClick={() => {
                            const input = document.getElementById("agent-avatar-input");
                            if (input) (input as HTMLInputElement).click();
                          }}
                          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center bg-white hover:bg-slate-50 hover:border-slate-800 ${
                            agentDragActive
                              ? "border-yellow-500 bg-yellow-50 scale-102"
                              : "border-slate-300 text-slate-500"
                          }`}
                        >
                          <input
                            id="agent-avatar-input"
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={handleAgentFileChange}
                            className="hidden"
                          />
                          <span className="text-xs font-bold text-slate-800">
                            Drag &amp; drop Avatar PNG/JPG here
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            or click to browse your folders
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      System Instruction Prompt (controlling agent responses):
                    </label>
                    <textarea
                      id="input-agent-prompt"
                      rows={4}
                      placeholder="Type guidelines on how the AI agent acts. E.g., 'You are Robot Buddy, a friendly virtual tutor. Speak in very simple English suitable for 8-year-old school pupils...'"
                      value={agentPrompt}
                      onChange={(e) => setAgentPrompt(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-3 border-slate-900 font-semibold text-sm focus:outline-none focus:ring-4 focus:ring-yellow-100"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Storybook + Quiz + Inspire Cards */}
              <div className="bg-white border-4 border-slate-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <legend className="text-blue-500 font-black text-sm uppercase tracking-wider mb-2">
                  Section 3 — Curricula, Quizzes &amp; Prompts
                </legend>
                <h3 className="text-lg font-black text-slate-800 mb-1">Create Storybook &amp; Quizzes</h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-6">
                  Add pages for children to slide through and matching interactive quizzes.
                </p>

                {/* Sub-section: Storybook */}
                <div className="bg-blue-50/50 rounded-2xl p-4 border-2 border-blue-200 mb-6 space-y-4">
                  <h4 className="font-bold text-blue-800 text-sm flex items-center gap-1.5 border-b pb-2 border-blue-200">
                    <BookOpen className="w-4 h-4" /> Storybook Details
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Storybook Title:
                    </label>
                    <input
                      id="input-storybook-title"
                      type="text"
                      placeholder="e.g. The Honest Chatbot Puzzle"
                      value={storybookTitle}
                      onChange={(e) => setStorybookTitle(e.target.value)}
                      className="w-full bg-white px-4 py-2.5 rounded-xl border-3 border-slate-900 font-bold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-4 pt-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Storybook Slide Pages:
                    </label>
                    {storybookPages.map((page, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border-2 border-slate-300 relative space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Slide Page {idx + 1}
                          </span>
                          {storybookPages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStoryPage(idx)}
                              className="text-rose-500 hover:text-rose-700 font-bold text-xs flex items-center gap-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove Slide
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            Page text describing the story:
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Type page content. Keep sentences short and extremely simple."
                            value={page}
                            onChange={(e) => handlePageChange(e.target.value, idx)}
                            className="w-full p-2 text-sm border border-slate-300 rounded font-medium focus:outline-none focus:ring-2 focus:ring-blue-100"
                          ></textarea>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-700 mb-1 tracking-wide uppercase">
                            Upload PNG Illustration or PDF Material:
                          </label>
                          {storybookImages[idx] ? (
                            <div className="border-2 border-slate-900 rounded-xl p-3 bg-slate-50 flex items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                              <div className="flex items-center gap-3 overflow-hidden">
                                {storybookImages[idx].startsWith("data:application/pdf") ? (
                                  <div className="w-12 h-12 bg-rose-100 border-2 border-rose-500 rounded-lg flex flex-shrink-0 items-center justify-center font-black text-xs text-rose-700 shadow-sm">
                                    PDF
                                  </div>
                                ) : (
                                  <img
                                    src={storybookImages[idx]}
                                    alt="Uploaded scene illustration"
                                    referrerPolicy="no-referrer"
                                    className="w-12 h-12 rounded-lg border-2 border-slate-900 object-cover bg-white"
                                  />
                                )}
                                <div className="text-left overflow-hidden">
                                  <span className="block text-xs font-black text-slate-900 truncate">
                                    {storybookImages[idx].startsWith("data:application/pdf") ? "PDF Document loaded" : "PNG Image loaded"}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-500 block">
                                    Ready to publish !
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handlePageImageChange("", idx)}
                                className="bg-rose-100 hover:bg-rose-200 text-rose-600 font-extrabold pr-2.5 pl-2 py-1 text-[10px] rounded-lg border-2 border-rose-600 cursor-pointer shadow-[1px_1px_0px_rgba(15,23,42,1)]"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <div
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDragLeave={(e) => handleDragLeave(e, idx)}
                              onDrop={(e) => handleDrop(e, idx)}
                              onClick={() => {
                                const input = document.getElementById(`file-input-${idx}`);
                                if (input) (input as HTMLInputElement).click();
                              }}
                              className={`border-3 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 hover:border-slate-800 ${
                                dragActiveStates[idx]
                                  ? "border-blue-500 bg-blue-50 scale-102"
                                  : "border-slate-300 text-slate-500"
                              }`}
                            >
                              <input
                                id={`file-input-${idx}`}
                                type="file"
                                accept="image/png, application/pdf"
                                onChange={(e) => handleFileChange(e, idx)}
                                className="hidden"
                              />
                              <div className="text-2xl">📁</div>
                              <span className="text-xs font-bold text-slate-800">
                                Drag &amp; drop PDF / PNG here
                              </span>
                              <span className="text-[9px] font-semibold text-slate-400">
                                or click to select from folders
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addStoryPage}
                      className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold text-xs py-2 rounded-xl border border-blue-400 cursor-pointer"
                    >
                      + Add Storybook Page
                    </button>
                  </div>
                </div>

                {/* Sub-section: Quizzes */}
                <div className="bg-pink-50/40 rounded-2xl p-4 border-2 border-pink-200 mb-6 space-y-4">
                  <h4 className="font-bold text-pink-800 text-sm flex items-center gap-1.5 border-b pb-2 border-pink-200">
                    <Award className="w-4 h-4" /> Multiple Choice / True-False Quizzes
                  </h4>

                  <div className="space-y-4">
                    {quizzes.map((q, qIdx) => (
                      <div
                        key={q.id}
                        className="bg-white p-4 rounded-xl border-2 border-slate-300 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                            Question #{qIdx + 1}
                          </span>
                          {quizzes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuiz(qIdx)}
                              className="text-rose-500 hover:text-rose-700 font-bold text-xs flex items-center gap-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Question
                            </button>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="e.g. Is it ok to let AI write your homework essays?"
                            value={q.question}
                            onChange={(e) => updateQuiz({ question: e.target.value }, qIdx)}
                            className="w-full p-2 border border-slate-300 rounded font-bold text-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-slate-500">
                            Answer Choices:
                          </label>
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 w-4">
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <input
                                type="text"
                                placeholder={`Option ${String.fromCharCode(65 + oIdx)} text`}
                                value={opt}
                                onChange={(e) => updateQuizOption(e.target.value, qIdx, oIdx)}
                                className="flex-1 p-2 border border-slate-200 rounded text-xs"
                              />
                            </div>
                          ))}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Correct Answer Option (0-indexed or choose choice letter):
                          </label>
                          <select
                            value={q.correctAnswer}
                            onChange={(e) => updateQuiz({ correctAnswer: parseInt(e.target.value) }, qIdx)}
                            className="bg-slate-50 border border-slate-300 rounded p-1 text-xs text-slate-700"
                          >
                            <option value={0}>Option A is Correct</option>
                            <option value={1}>Option B is Correct</option>
                            <option value={2}>Option C is Correct</option>
                          </select>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addQuiz}
                      className="w-full bg-pink-100 hover:bg-pink-200 text-pink-800 font-bold text-xs py-2 rounded-xl border border-pink-400 cursor-pointer"
                    >
                      + Add Quiz Question
                    </button>
                  </div>
                </div>

                {/* Sub-section: Inspire cards */}
                <div className="bg-yellow-50/50 rounded-2xl p-4 border-2 border-yellow-200 space-y-4">
                  <h4 className="font-bold text-yellow-800 text-sm flex items-center gap-1.5 border-b pb-2 border-yellow-200">
                    <Sparkles className="w-4 h-4 text-yellow-500" /> Pre-written &quot;Inspire Cards&quot;
                  </h4>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    Short prompts students clicked to instantly message AI!
                  </p>

                  <div className="space-y-2">
                    {inspireCards.map((card, idx) => (
                      <div key={card.id} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-6">#{idx + 1}</span>
                        <input
                          type="text"
                          placeholder="e.g. Is a computer program alive?"
                          value={card.text}
                          onChange={(e) => handleInspireChange(e.target.value, idx)}
                          className="flex-1 p-2 border border-slate-300 rounded text-xs font-bold"
                        />
                        {inspireCards.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInspireCard(idx)}
                            className="bg-white border rounded text-rose-500 hover:text-rose-700 p-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addInspireCard}
                      className="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold text-xs py-2 rounded-xl border border-yellow-400 cursor-pointer"
                    >
                      + Create Inspire Card
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col - Action & Preset Reference list */}
            <div className="space-y-6">
              <div className="bg-white border-4 border-slate-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] text-center">
                <h3 className="font-black text-slate-900 text-lg mb-1">Save Classroom</h3>
                <p className="text-xs text-slate-500 mb-6">
                  Click below to synthesize the e-learning room and get a short, easy Classroom Code.
                </p>

                <button
                  id="btn-save-classroom"
                  onClick={handleSaveClassroom}
                  disabled={loading}
                  className="w-full bg-yellow-300 hover:bg-yellow-400 disabled:opacity-50 text-slate-900 font-black py-4 px-6 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-pink-500 animate-pulse" />
                  {loading ? "Generating Code..." : "Create & Save Classroom"}
                </button>
              </div>

              {/* Guide card */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <h4 className="font-black text-lg mb-2 flex items-center gap-2 text-yellow-300">
                  ✏️ Prompts Design Guide:
                </h4>
                <ul className="text-xs space-y-2 list-disc list-inside text-slate-300 font-medium font-sans">
                  <li>Keep instructions simple. Direct the bot to reply in short sentences.</li>
                  <li>Mention the target age: 8-10 years old.</li>
                  <li>Enforce safety: polite and staying on storybook topics.</li>
                  <li>
                    The bot will greet participants when they enter or ask stories inquiries.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: CLASSROOM MONITORING METRICS */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Class list drawer */}
            <div className="md:col-span-1 space-y-4">
              <h3 className="font-extrabold text-slate-700 text-sm">Select Classroom:</h3>
              {classrooms.length === 0 ? (
                <div className="text-slate-400 text-xs font-semibold p-4 border border-dashed rounded-lg bg-white">
                  No classrooms created yet. Create one on the first tab!
                </div>
              ) : (
                <div className="space-y-2">
                  {classrooms.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setSelectedMonitorCode(c.code)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-1 ${
                        selectedMonitorCode === c.code
                          ? "bg-blue-50 border-blue-500 font-bold text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                          : "bg-white border-slate-300 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <span className="font-black text-xs text-blue-600 font-mono">
                        {c.code}
                      </span>
                      <span className="text-sm font-bold truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Monitoring Stats view container */}
            <div className="md:col-span-3 space-y-6">
              {monitoringStats ? (
                <div className="space-y-6">
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-yellow-100 border-4 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                      <span className="block text-xs font-bold text-yellow-800 uppercase">
                        Class Average Score
                      </span>
                      <span className="text-3xl font-black text-slate-900">
                        {monitoringStats.classAverage} pts
                      </span>
                    </div>

                    <div className="bg-blue-100 border-4 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                      <span className="block text-xs font-bold text-blue-800 uppercase">
                        Total Joined Students
                      </span>
                      <span className="text-3xl font-black text-slate-900">
                        {monitoringStats.totalStudents} pupils
                      </span>
                    </div>

                    <div className="bg-pink-100 border-4 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                      <span className="block text-xs font-bold text-pink-800 uppercase">
                        Shared Group Messages
                      </span>
                      <span className="text-3xl font-black text-slate-900">
                        {monitoringStats.messagesCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Students Performance List */}
                  <div className="bg-white border-4 border-slate-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                    <h3 className="font-black text-lg text-slate-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" /> Student Scoreboard &amp; Badges
                    </h3>

                    {monitoringStats.studentList.length === 0 ? (
                      <div className="text-slate-400 font-semibold text-center text-xs py-8 border border-dashed rounded-xl">
                        No students have logged into this classroom yet. Share the code to start live!
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-3 font-bold text-slate-600">Student Class Number</th>
                              <th className="p-3 font-bold text-slate-600 text-center">Participation Level</th>
                              <th className="p-3 font-bold text-slate-600 text-right">Earned Badges</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {monitoringStats.studentList.map((st: any) => (
                              <tr key={st.username} className="hover:bg-slate-50">
                                <td className="p-3 font-black text-slate-900 flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                                  {st.username}
                                </td>
                                <td className="p-3 text-center font-bold text-slate-700">
                                  {st.score} XP
                                </td>
                                <td className="p-3 text-right">
                                  {st.badgesCount === 0 ? (
                                    <span className="text-slate-400 font-medium">None yet</span>
                                  ) : (
                                    <div className="inline-flex flex-wrap gap-1 justify-end">
                                      {st.badges.map((b: string) => (
                                        <span
                                          key={b}
                                          className="bg-yellow-100 text-yellow-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-300"
                                        >
                                          🏆 {b.replace("q", "badge ")}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-center font-semibold text-xs py-12 bg-white rounded-2xl border-2 border-dashed">
                  Select a room on the left side to review real-time parameters.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
