/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import pg from "pg";
import { Classroom, Student, ChatMessage } from "../src/types.js";

// Path for local database fallback
const LOCAL_DB_PATH = path.join(process.cwd(), "db_local.json");

// Db Helper Interface
export interface DbInterface {
  init(): Promise<void>;
  // Classrooms
  createClassroom(classroom: Classroom): Promise<void>;
  getClassroom(code: string): Promise<Classroom | null>;
  getAllClassrooms(): Promise<Classroom[]>;
  // Students
  upsertStudent(student: Student): Promise<void>;
  getStudent(username: string, classroomCode: string): Promise<Student | null>;
  getClassroomStudents(classroomCode: string): Promise<Student[]>;
  // Messages
  saveMessage(message: ChatMessage): Promise<void>;
  getClassroomMessages(classroomCode: string): Promise<ChatMessage[]>;
}

// 1. Local Database Implementation (JSON-file Based)
class LocalDb implements DbInterface {
  private data: {
    classrooms: Record<string, Classroom>;
    students: Record<string, Student>; // key: `${username}:${classroomCode}`
    messages: ChatMessage[];
  } = {
    classrooms: {},
    students: {},
    messages: [],
  };

  async init(): Promise<void> {
    try {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const fileContent = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
      console.log("Local JSON Database initialized successfully.");
    } catch (err) {
      console.error("Failed to initialize Local Database, using in-memory:", err);
    }
  }

  private save() {
    try {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write to local database file:", err);
    }
  }

  async createClassroom(classroom: Classroom): Promise<void> {
    this.data.classrooms[classroom.code] = classroom;
    this.save();
  }

  async getClassroom(code: string): Promise<Classroom | null> {
    return this.data.classrooms[code] || null;
  }

  async getAllClassrooms(): Promise<Classroom[]> {
    return Object.values(this.data.classrooms);
  }

  async upsertStudent(student: Student): Promise<void> {
    const key = `${student.username}:${student.classroomCode}`;
    this.data.students[key] = { ...student };
    this.save();
  }

  async getStudent(username: string, classroomCode: string): Promise<Student | null> {
    const key = `${username}:${classroomCode}`;
    return this.data.students[key] || null;
  }

  async getClassroomStudents(classroomCode: string): Promise<Student[]> {
    return Object.values(this.data.students).filter(
      (s) => s.classroomCode === classroomCode
    );
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    this.data.messages.push(message);
    this.save();
  }

  async getClassroomMessages(classroomCode: string): Promise<ChatMessage[]> {
    return this.data.messages.filter((m) => m.classroomCode === classroomCode);
  }
}

// 2. PostgreSQL Implementation (Production Driver)
class PostgresDb implements DbInterface {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false }, // required for cloud-hosted DBs like Railway
    });
  }

  async init(): Promise<void> {
    try {
      const client = await this.pool.connect();
      console.log("Connected to PostgreSQL Database.");

      // Create Tables if not exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS classrooms (
          code VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          agent_name VARCHAR(100) NOT NULL,
          agent_prompt TEXT NOT NULL,
          agent_image TEXT NOT NULL,
          storybook_title VARCHAR(255) NOT NULL,
          storybook_pages TEXT NOT NULL,
          storybook_images TEXT NOT NULL,
          quizzes TEXT NOT NULL,
          inspire_cards TEXT NOT NULL,
          created_at VARCHAR(100) NOT NULL
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS students (
          username VARCHAR(100) NOT NULL,
          classroom_code VARCHAR(50) NOT NULL,
          score INTEGER NOT NULL DEFAULT 0,
          badges TEXT NOT NULL,
          joined_at VARCHAR(100) NOT NULL,
          PRIMARY KEY (username, classroom_code)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(100) PRIMARY KEY,
          classroom_code VARCHAR(50) NOT NULL,
          sender VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL,
          text TEXT NOT NULL,
          timestamp VARCHAR(100) NOT NULL,
          media_url TEXT
        );
      `);

      client.release();
      console.log("PostgreSQL schema validated/created successfully.");
    } catch (err) {
      console.error("Failed to initialize PostgreSQL connection pool:", err);
      throw err;
    }
  }

  async createClassroom(classroom: Classroom): Promise<void> {
    await this.pool.query(
      `INSERT INTO classrooms (
        code, name, agent_name, agent_prompt, agent_image, 
        storybook_title, storybook_pages, storybook_images, quizzes, inspire_cards, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        classroom.code,
        classroom.name,
        classroom.agentName,
        classroom.agentPrompt,
        classroom.agentImage,
        classroom.storybookTitle,
        JSON.stringify(classroom.storybookPages),
        JSON.stringify(classroom.storybookImages),
        JSON.stringify(classroom.quizzes),
        JSON.stringify(classroom.inspireCards),
        classroom.createdAt,
      ]
    );
  }

  async getClassroom(code: string): Promise<Classroom | null> {
    const res = await this.pool.query("SELECT * FROM classrooms WHERE code = $1", [code]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      code: row.code,
      name: row.name,
      agentName: row.agent_name,
      agentPrompt: row.agent_prompt,
      agentImage: row.agent_image,
      storybookTitle: row.storybook_title,
      storybookPages: JSON.parse(row.storybook_pages),
      storybookImages: JSON.parse(row.storybook_images),
      quizzes: JSON.parse(row.quizzes),
      inspireCards: JSON.parse(row.inspire_cards),
      createdAt: row.created_at,
    };
  }

  async getAllClassrooms(): Promise<Classroom[]> {
    const res = await this.pool.query("SELECT * FROM classrooms ORDER BY created_at DESC");
    return res.rows.map((row) => ({
      code: row.code,
      name: row.name,
      agentName: row.agent_name,
      agentPrompt: row.agent_prompt,
      agentImage: row.agent_image,
      storybookTitle: row.storybook_title,
      storybookPages: JSON.parse(row.storybook_pages),
      storybookImages: JSON.parse(row.storybook_images),
      quizzes: JSON.parse(row.quizzes),
      inspireCards: JSON.parse(row.inspire_cards),
      createdAt: row.created_at,
    }));
  }

  async upsertStudent(student: Student): Promise<void> {
    await this.pool.query(
      `INSERT INTO students (username, classroom_code, score, badges, joined_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username, classroom_code)
       DO UPDATE SET score = EXCLUDED.score, badges = EXCLUDED.badges`,
      [
        student.username,
        student.classroomCode,
        student.score,
        JSON.stringify(student.badges),
        student.joinedAt,
      ]
    );
  }

  async getStudent(username: string, classroomCode: string): Promise<Student | null> {
    const res = await this.pool.query(
      "SELECT * FROM students WHERE username = $1 AND classroom_code = $2",
      [username, classroomCode]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      username: row.username,
      classroomCode: row.classroom_code,
      score: row.score,
      badges: JSON.parse(row.badges),
      joinedAt: row.joined_at,
    };
  }

  async getClassroomStudents(classroomCode: string): Promise<Student[]> {
    const res = await this.pool.query(
      "SELECT * FROM students WHERE classroom_code = $1 ORDER BY score DESC, username ASC",
      [classroomCode]
    );
    return res.rows.map((row) => ({
      username: row.username,
      classroomCode: row.classroom_code,
      score: row.score,
      badges: JSON.parse(row.badges),
      joinedAt: row.joined_at,
    }));
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    await this.pool.query(
      `INSERT INTO messages (id, classroom_code, sender, role, text, timestamp, media_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        message.id,
        message.classroomCode,
        message.sender,
        message.role,
        message.text,
        message.timestamp,
        message.mediaUrl || null,
      ]
    );
  }

  async getClassroomMessages(classroomCode: string): Promise<ChatMessage[]> {
    const res = await this.pool.query(
      "SELECT * FROM messages WHERE classroom_code = $1 ORDER BY timestamp ASC",
      [classroomCode]
    );
    return res.rows.map((row) => ({
      id: row.id,
      classroomCode: row.classroom_code,
      sender: row.sender,
      role: row.role as ChatMessage["role"],
      text: row.text,
      timestamp: row.timestamp,
      mediaUrl: row.media_url,
    }));
  }
}

// 3. Dual-Mode DB Orchestrator
let dbInstance: DbInterface;

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  console.log("PostgreSQL connection string verified. Instantiating PostgreSQL database provider...");
  dbInstance = new PostgresDb(databaseUrl);
} else {
  console.log("No PostgreSQL connection details provided (normal for dev sandbox). Instantiating Local JSON database provider...");
  dbInstance = new LocalDb();
}

export { dbInstance as db };
