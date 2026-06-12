/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import { db } from "./server/db.js";
import { geminiQueue, ai } from "./server/gemini.js";
import { Classroom, Student, ChatMessage } from "./src/types.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function evaluateMessageForXP(text: string, sender: string): Promise<{ earned: boolean; reason: string }> {
  const trimmed = text.trim();
  const lowercaseText = trimmed.toLowerCase();

  // 1. Basic length check (Effectiveness)
  if (trimmed.length < 3) {
    return {
      earned: false,
      reason: "Message is too brief to be effective. Try sharing a complete thought or idea! 💡"
    };
  }

  // 2. Spam check (repeating same character over and over)
  if (/(.)\1{4,}/.test(trimmed)) {
    return {
      earned: false,
      reason: "Your message seems to contain repeated characters. Let's type real helpful words! 📁"
    };
  }

  // 3. Civility check (Uncivil words filter)
  const uncivilPatterns = [
    "sb", "fck", "fuck", "shit", "bitch", "rubbish", "trash", "idiot", "dumb", "stupid", "bastard", "asshole", "hate you", "shut up",
    "垃圾", "傻逼", "煞笔", "傻b", "蠢货", "草泥马", "曹尼玛", "混蛋", "二百五", "智障", "滚开", "骂人", "死人", "贱", "闭嘴", "他妈", "王八蛋"
  ];
  for (const block of uncivilPatterns) {
    if (lowercaseText.includes(block)) {
      return {
        earned: false,
        reason: "Let's keep our classroom civil and friendly! Disrespectful or uncivil words do not earn any XP. 👋"
      };
    }
  }

  // 4. Check if it's a direct helpful reply or dialogue
  const isReply = trimmed.includes("@") || lowercaseText.includes("agree") || lowercaseText.includes("disagree") || lowercaseText.includes("think") || lowercaseText.includes("because") || trimmed.includes("同意") || trimmed.includes("不同意") || trimmed.includes("觉得") || trimmed.includes("因为") || trimmed.includes("我认为") || trimmed.includes("对的") || trimmed.includes("不对");
  const onTopicIndicators = ["ethics", "ai", "robo", "story", "book", "moral", "page", "right", "wrong", "safe", "help", "fair", "privacy", "bias", "computer", "machine", "truth", "responsibility", "责任", "道德", "公平", "安全", "故事", "书", "智能", "学习", "老师", "学生", "觉得", "认为", "观点", "讨论", "诚实", "尊重"];

  // 5. Try calling Gemini for smart child-friendly evaluation if available
  if (process.env.GEMINI_API_KEY && ai) {
    try {
      const prompt = `You are an AI Classroom assistant. Help us evaluate a student's message in a discussion about an interactive ethics & AI storybook.
Verify if this message is civil (polite/respectful), effective (has actual substance, is not gibberish or spam), and correct/on-topic or a friendly reply to classmates/teachers.

Student username: "${sender}"
Message: "${trimmed}"

Respond in EXACT JSON format:
{
  "isGood": true/false,
  "reason": "very short 1-sentence explanation of assessment to the student"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 150,
        }
      });

      const responseText = response.text || "";
      const parsed = JSON.parse(responseText.trim());
      if (parsed && typeof parsed.isGood === "boolean") {
        return {
          earned: parsed.isGood,
          reason: parsed.reason || "Processed by the ethics validator."
        };
      }
    } catch (err) {
      console.warn("AI civility evaluation failed, using local rules:", err);
    }
  }

  // 6. Heuristic Fallback
  const hasOnTopicKwd = onTopicIndicators.some(k => lowercaseText.includes(k));
  if (isReply || hasOnTopicKwd || trimmed.length >= 6) {
    return {
      earned: true,
      reason: isReply 
        ? "🎉 Nice team interaction! Thank you for replying to classmates and cooperating!"
        : "🎉 Fantastic effort! Civil, constructive, and on-topic contribution to our ethical discussions!"
    };
  }

  return {
    earned: false,
    reason: "Your comment is polite, but is it too brief or off-topic? Try discussing the storybook page, ethics, or replying to classmates to earn XP! 💡"
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize DB
  await db.init();

  // Preseed default classrooms if empty
  await preseedDefaultClassrooms();

  // API ROUTE: Get classroom by invite code
  app.get("/api/classrooms/:code", async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const classroom = await db.getClassroom(code);
      if (!classroom) {
        return res.status(404).json({ error: "Classroom not found. Please check your invite code!" });
      }
      res.json(classroom);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API ROUTE: Create a new classroom
  app.post("/api/classrooms", async (req, res) => {
    try {
      const {
        name,
        agentName,
        agentPrompt,
        agentImage,
        storybookTitle,
        storybookPages,
        storybookImages,
        quizzes,
        inspireCards,
      } = req.body;

      if (!name || !agentName || !agentPrompt || !storybookTitle) {
        return res.status(400).json({ error: "Please fill in all classroom details." });
      }

      // Generate a short user-friendly code like AI-1025
      let code = "";
      let isUnique = false;
      let checkCount = 0;

      while (!isUnique && checkCount < 10) {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        code = `AI-${randNum}`;
        const existing = await db.getClassroom(code);
        if (!existing) {
          isUnique = true;
        }
        checkCount++;
      }

      const newClassroom: Classroom = {
        code,
        name,
        agentName,
        agentPrompt,
        agentImage: agentImage || "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=200",
        storybookTitle,
        storybookPages: storybookPages || [],
        storybookImages: storybookImages || [],
        quizzes: quizzes || [],
        inspireCards: inspireCards || [],
        createdAt: new Date().toISOString(),
      };

      await db.createClassroom(newClassroom);
      console.log(`Classroom ${name} created with code ${code}`);
      res.status(201).json(newClassroom);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API ROUTE: Get list of classrooms for Teacher Dashboard
  app.get("/api/classrooms", async (req, res) => {
    try {
      const list = await db.getAllClassrooms();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API ROUTE: Get students metrics & statistics for monitoring
  app.get("/api/classrooms/:code/stats", async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const students = await db.getClassroomStudents(code);
      const messages = await db.getClassroomMessages(code);

      const totalStudents = students.length;
      const classAverage =
        totalStudents > 0
          ? Math.round(students.reduce((acc, s) => acc + s.score, 0) / totalStudents)
          : 0;

      const studentList = students.map((s) => ({
        username: s.username,
        score: s.score,
        badgesCount: s.badges.length,
        badges: s.badges,
      }));

      res.json({
        classAverage,
        totalStudents,
        studentList,
        messagesCount: messages.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API ROUTE: Student Login
  app.post("/api/students/login", async (req, res) => {
    try {
      const { username, classroomCode } = req.body;
      if (!username || !classroomCode) {
        return res.status(400).json({ error: "Please enter both Username and Classroom Code." });
      }

      const code = classroomCode.toUpperCase();
      const classroom = await db.getClassroom(code);
      if (!classroom) {
        return res.status(404).json({ error: "Classroom not found. Please verify the code!" });
      }

      // Find or create student session
      let student = await db.getStudent(username, code);
      if (!student) {
        student = {
          username,
          classroomCode: code,
          score: 0,
          badges: [],
          joinedAt: new Date().toISOString(),
        };
        await db.upsertStudent(student);
      }

      res.json({ student, classroom });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Real-time communication orchestrator using Socket.io
  io.on("connection", (socket) => {
    let currentRoom = "";
    let currentUser = "";
    let currentRole: "student" | "teacher" | "ai" | "system" = "student";

    // 1. User Joins Classroom Room
    socket.on("join_classroom", async ({ classroomCode, username, role }) => {
      currentRoom = classroomCode.toUpperCase();
      currentUser = username;
      currentRole = role || "student";

      socket.join(currentRoom);
      console.log(`Socket [${socket.id}] joined room ${currentRoom} as ${username} (${currentRole})`);

      // Retrieve and emit current state (messages, students list) to the freshly connected socket
      try {
        const messages = await db.getClassroomMessages(currentRoom);
        const students = await db.getClassroomStudents(currentRoom);

        socket.emit("initial_sync", { messages, students });

        // Broadcast System Alert: User has joined
        const systemMessage: ChatMessage = {
          id: `sys-${Date.now()}-${Math.random()}`,
          classroomCode: currentRoom,
          sender: "System",
          role: "system",
          text: `🎉 Welcome ${username} to the classroom! Let's read and learn together!`,
          timestamp: new Date().toISOString(),
        };

        await db.saveMessage(systemMessage);
        io.to(currentRoom).emit("message", systemMessage);

        // Update students list on leaderboard
        io.to(currentRoom).emit("leaderboard_update", students);
      } catch (err) {
        console.error("Error during join_classroom sync:", err);
      }
    });

    // 2. Message exchange and routing
    socket.on("send_message", async ({ text, mediaUrl }) => {
      if (!currentRoom || !currentUser) return;

      try {
        const classroom = await db.getClassroom(currentRoom);
        if (!classroom) return;

        const timestampStr = new Date().toISOString();
        const msgId = `msg-${Date.now()}-${Math.random()}`;

        // Create Chat message
        const chatMessage: ChatMessage = {
          id: msgId,
          classroomCode: currentRoom,
          sender: currentUser,
          role: currentRole as any,
          text,
          timestamp: timestampStr,
          mediaUrl,
        };

        // Persist message
        await db.saveMessage(chatMessage);
        
        // Broadcast to everyone in the room
        io.to(currentRoom).emit("message", chatMessage);

        // Handle scoring points (+5 points for sending correct, civil, and effective messages or replying)
        if (currentRole === "student") {
          evaluateMessageForXP(text, currentUser).then(async (resEval) => {
            const student = await db.getStudent(currentUser, currentRoom);
            if (student) {
              if (resEval.earned) {
                student.score += 5;
                await db.upsertStudent(student);
              }

              // Emit individual XP evaluation feedback toast to the sender's client
              socket.emit("xp_result", {
                earned: resEval.earned,
                amount: resEval.earned ? 5 : 0,
                reason: resEval.reason,
                newScore: student.score
              });

              if (resEval.earned) {
                // Fetch and broadcast updated leaderboard list to room partners
                const updatedStudents = await db.getClassroomStudents(currentRoom);
                io.to(currentRoom).emit("leaderboard_update", updatedStudents);
              }
            }
          }).catch((err) => {
            console.error("Failed to evaluate student chat message for XP score:", err);
          });
        }

        // 3. AI Trigger evaluation
        // Simple conditions to trigger agent reactions:
        // - Message mentions agent name (case-insensitive)
        // - Message contains a question mark '?'
        // - Message is an Inspire Card click
        const lowerText = text.toLowerCase();
        const mentionsAgent = lowerText.includes(classroom.agentName.toLowerCase());
        const isQuestion = lowerText.includes("?");
        const isInspireCard = lowerText.startsWith("[inspire]");

        if (currentRole !== "ai" && currentRole !== "system" && (mentionsAgent || isQuestion || isInspireCard)) {
          console.log(`Triggering AI Agent [${classroom.agentName}] in room ${currentRoom}`);

          // Emit "AI typing" or queue progress event to users
          io.to(currentRoom).emit("ai_status", {
            status: "queued",
            text: `${classroom.agentName} is thinking...`,
            position: 1,
          });

          // Fetch recent chat history to give context to Gemini
          const messages = await db.getClassroomMessages(currentRoom);
          const history = messages
            .filter((m) => m.role === "student" || m.role === "ai" || m.role === "teacher")
            .slice(-6)
            .map((m) => ({
              role: m.role === "ai" ? "ai" : "user",
              text: `${m.sender}: ${m.text}`,
            }));

          // Clean message text if it has our internal [inspire] flag
          let cleanInput = text;
          if (isInspireCard) {
            cleanInput = text.replace("[inspire]", "").trim();
          }

          // Enqueue LLM execution
          geminiQueue.enqueue(
            classroom.agentPrompt,
            history,
            cleanInput,
            currentRoom,
            (status, position) => {
              // Handler to update the UI on queue positions in real-time
              const statusLabel =
                status === "queued"
                  ? `${classroom.agentName} is waiting in request queue (Pos: ${position})`
                  : `${classroom.agentName} is writing replies... ✏️`;
              
              io.to(currentRoom).emit("ai_status", {
                status,
                text: statusLabel,
                position,
              });
            }
          ).then(async (aiReplyText) => {
            // Success: construct AI Message
            const aiMsgId = `ai-${Date.now()}-${Math.random()}`;
            const aiMessage: ChatMessage = {
              id: aiMsgId,
              classroomCode: currentRoom,
              sender: classroom.agentName,
              role: "ai",
              text: aiReplyText,
              timestamp: new Date().toISOString(),
            };

            await db.saveMessage(aiMessage);
            io.to(currentRoom).emit("message", aiMessage);
            io.to(currentRoom).emit("ai_status", { status: "idle", text: "" });
          }).catch((err) => {
            console.error("AI processing failed, sending silent error alert:", err);
            io.to(currentRoom).emit("ai_status", { status: "idle", text: "" });

            // Send standard failure message from agent
            const errMessage: ChatMessage = {
              id: `err-${Date.now()}`,
              classroomCode: currentRoom,
              sender: classroom.agentName,
              role: "ai",
              text: "Oops! My robot antennas got slightly tangled. Could you repeat that question for me? 📡🤖",
              timestamp: new Date().toISOString(),
            };
            io.to(currentRoom).emit("message", errMessage);
          });
        }
      } catch (err) {
        console.error("Error processing sent message:", err);
      }
    });

    // 3. Quiz submission and verification scoring
    socket.on("submit_quiz", async ({ username, classroomCode, quizId, isCorrect }) => {
      try {
        const roomToUse = (classroomCode || currentRoom || "").toUpperCase();
        const userToUse = username || currentUser;
        const student = await db.getStudent(userToUse, roomToUse);
        if (!student) {
          console.warn(`Student "${userToUse}" not found in room "${roomToUse}" during quiz submission.`);
          return;
        }

        // Check if badge is already earned by student for this quiz question
        const hasBadge = student.badges.includes(quizId);

        if (isCorrect) {
          // Double checking prevention
          if (!hasBadge) {
            student.score += 5;
            student.badges.push(quizId);
            await db.upsertStudent(student);

            // Broadcast standard System congratulatory chat message of correct submission
            const systemMsg: ChatMessage = {
              id: `sys-${Date.now()}`,
              classroomCode: roomToUse,
              sender: "System",
              role: "system",
              text: `🌟 AMAZING! ${userToUse} answered Quiz Question #${quizId.replace("q", "")} correctly, scored +5 points and earned a new Badge! 🏆`,
              timestamp: new Date().toISOString(),
            };
            await db.saveMessage(systemMsg);
            io.to(roomToUse).emit("message", systemMsg);
          } else {
            // Correct, but badge already earned
            socket.emit("quiz_result_feedback", {
              success: true,
              message: "Correct answer! You already earned this badge, but great job reviewing the story!",
            });
            return;
          }
        }

        // Broadcast leaderboard modifications
        const students = await db.getClassroomStudents(roomToUse);
        io.to(roomToUse).emit("leaderboard_update", students);

        // Feedback specifically to the sender
        socket.emit("quiz_result_feedback", {
          success: isCorrect,
          message: isCorrect
            ? "Whoopee! Correct answer +5 points and 1 badge awarded! 🎓⭐"
            : "Nice try! Let's read the storybook pages carefully and try again! You can do it! 💪📚",
        });
      } catch (err) {
        console.error("Failed to solve quiz submission: ", err);
      }
    });

    socket.on("disconnect", () => {
      if (currentRoom && currentUser) {
        console.log(`Socket disconnect: ${currentUser} left ${currentRoom}`);
      }
    });
  });

  // Vite development vs compilation asset serving definitions
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development instance with hot-reload proxy...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving compiled static production assets from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Collaborative AI Learning Server running on http://localhost:${PORT}`);
  });
}

// Preseed Default classrooms for direct preview testing
async function preseedDefaultClassrooms() {
  try {
    const list = await db.getAllClassrooms();
    if (list.length > 0) {
      console.log("Classrooms database is already populated, skipping preseed.");
      return;
    }

    console.log("Seeding default classrooms...");

    const preseeded = [
      {
        code: "ETHICS-101",
        name: "Class 3A AI Ethics",
        agentName: "AI-Guard Robot",
        agentPrompt: "You are a friendly, caring school security robot named AI-Guard. You guide 8-10 year old school children regarding AI Ethics. Speak in very simple English with short sentences. If kids ask off-topic or inappropriate questions, politely say 'That's a fun topic, but let's focus on our storybook!' and ask a related question. Encourage them constantly. Always keep your replies under 3 sentences.",
        agentImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=200",
        storybookTitle: "The Secret of the Helpful Chatbot",
        storybookPages: [
          "Meet Echo, a digital chatbot assistant. Everyone in Sunnyville School loves Echo because it helps explain math problems and writes lovely poems! However, some children started asking Echo to do their entire homework essays for them. Is that right?",
          "The school teacher Mr. Han noticed that children were no longer learning. Echo noticed it too! Echo said: 'I can explain the rules of math, but I cannot learn for you. Learning trains your brain!' The children realized that using AI to copy answers is not honest.",
          "Happy learning! From that day on, Sunnyville students used Echo to explain difficult words, but they always wrote their own essays. Together, humans and AI became a great learning team!"
        ],
        storybookImages: [
          "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?auto=format&fit=crop&q=80&w=300",
          "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=300",
          "https://images.unsplash.com/photo-1577563906417-00c7e2938f94?auto=format&fit=crop&q=80&w=300"
        ],
        quizzes: [
          { id: "q1", question: "Why do Sunnyville students love Echo the chatbot?", options: ["It does all their chores", "It explains math and writes poems", "It has wheels and flies"], correctAnswer: 1 },
          { id: "q2", question: "Is it honest to let AI write your entire homework?", options: ["Yes, it saves time!", "No, because we do not train our own brains", "Only on Fridays"], correctAnswer: 1 },
          { id: "q3", question: "What is the best way to use a chatbot for school?", options: ["To explain difficult concepts while we do the work", "Let it write everything", "Copy its recipes"], correctAnswer: 0 }
        ],
        inspireCards: [
          { id: "i1", text: "Can Echo write my essay?" },
          { id: "i2", text: "Why is copying homework a bad idea?" },
          { id: "i3", text: "What is a chatbot's favorite rule of learning?" }
        ],
        createdAt: new Date().toISOString()
      },
      {
        code: "CREATIVE-AI",
        name: "Class 4B AI Art Creators",
        agentName: "PaintBot",
        agentPrompt: "You are PaintBot, a creative, cheerful art assistant. You speak in joyful, short, simple sentences suitable for primary school students. Discuss AI art ethics. Remind students that AI art relies on learning from existing artists, but real human creativity is unique! Always keep replies under 3 sentences.",
        agentImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200",
        storybookTitle: "The Copycat Painting Engine",
        storybookPages: [
          "PaintBot can read millions of human paintings online and instantly generate new, colorful digital drawings. 'Wow!' said Lilly. 'I am a master artist now!' But PaintBot smiled softly and said: 'I drew this by looking at how human artists painted. I can copy, but I don't feel the joy of paint.'",
          "Lilly realized that human artists spend years practicing, feeling emotions, and sharing their hearts in their paintings. Copying their styles without credit can sometimes make them sad. We must always respect human creators!",
          "Lilly decided to draw her own pictures and use PaintBot to brainstorm crazy color combinations. They laughed and created paintings together, blending human heart with computer paint!"
        ],
        storybookImages: [
          "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=300",
          "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=300",
          "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=300"
        ],
        quizzes: [
          { id: "q1", question: "How does PaintBot generate new digital paintings?", options: ["It draws with actual paint", "By studying millions of human artist style pictures", "It takes photographs"], correctAnswer: 1 },
          { id: "q2", question: "Does AI paint with emotions and real joy?", options: ["Yes, always", "No, it copies patterns without feeling emotion", "Only when sunny"], correctAnswer: 1 },
          { id: "q3", question: "Lilly and PaintBot became a team. How did they work?", options: ["PaintBot made all decisions", "Lilly drew her art and used PaintBot for colors", "They did not work together"], correctAnswer: 1 }
        ],
        inspireCards: [
          { id: "i1", text: "Do algorithms have feelings?" },
          { id: "i2", text: "How can we respect human painters?" },
          { id: "i3", text: "Can PaintBot teach me art?" }
        ],
        createdAt: new Date().toISOString()
      }
    ];

    for (const c of preseeded) {
      await db.createClassroom(c);
    }
    console.log("Preseed successful. Created default classrooms: ETHICS-101 and CREATIVE-AI.");
  } catch (err) {
    console.warn("Preseeding failed, proceeding anyway:", err);
  }
}

startServer();
