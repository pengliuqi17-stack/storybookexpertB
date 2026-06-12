/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client on server-side only
const apiKey = process.env.GEMINI_API_KEY;
export let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Google GenAI client initialized successfully with server-side credentials.");
  } catch (err) {
    console.error("Failed to initialize Google GenAI client:", err);
  }
} else {
  console.warn(
    "⚠️ GEMINI_API_KEY environment variable is not defined. The AI Agent will use simulated child-friendly replies."
  );
}

// Queue item definition
interface QueueItem {
  systemPrompt: string;
  history: { role: string; text: string }[];
  newMessage: string;
  classroomCode: string;
  onUpdate: (status: string, position: number) => void;
  resolve: (response: string) => void;
  reject: (error: Error) => void;
}

class GeminiRequestQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  // Enforce a minimum interval of 2.5 seconds between model calls (24 requests per minute limit safety)
  private readonly MIN_INTERVAL_MS = 2500;

  enqueue(
    systemPrompt: string,
    history: { role: string; text: string }[],
    newMessage: string,
    classroomCode: string,
    onUpdate: (status: string, position: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        systemPrompt,
        history,
        newMessage,
        classroomCode,
        onUpdate,
        resolve,
        reject,
      };
      this.queue.push(item);
      this.updateQueuePositions();
      this.processNext();
    });
  }

  private updateQueuePositions() {
    this.queue.forEach((item, index) => {
      // Index 0 in queue is being processed/next, notify other items
      if (index > 0) {
        item.onUpdate("queued", index);
      }
    });
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const item = this.queue.shift()!;
    this.updateQueuePositions();

    item.onUpdate("processing", 0);

    try {
      let replyText = "";

      if (!ai) {
        // Fallback friendly mock response if API Key is not set yet
        console.log("No Gemini API key available. Generating fallback response.");
        await new Promise((r) => setTimeout(r, 1200));
        replyText = this.generateFallbackResponse(item.newMessage, item.systemPrompt);
      } else {
        // Prepare contents payload structure according to @google/genai guidelines
        // Format previous history into Gemini contents format
        const formattedContents: any[] = [];
        
        // Add previous message history up to 10 items for context
        const contextHistory = item.history.slice(-10);
        contextHistory.forEach((h) => {
          formattedContents.push({
            role: h.role === "ai" ? "model" : "user",
            parts: [{ text: h.text }],
          });
        });

        // Add the current student message
        formattedContents.push({
          role: "user",
          parts: [{ text: item.newMessage }],
        });

        // Execute LLM call using gemini-3.5-flash
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: formattedContents,
          config: {
            systemInstruction: item.systemPrompt,
            // Low temperature for child friendliness & guardrails adherence
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        });

        replyText = response.text || "I'm thinking, but I couldn't write an answer. Let's try again or talk about the storybooks!";
      }

      // Resolve the original promise
      item.resolve(replyText);
    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      item.reject(error);
    } finally {
      // Throttle sequential requests to prevent API Rate Limits
      setTimeout(() => {
        this.processing = false;
        this.processNext();
      }, this.MIN_INTERVAL_MS);
    }
  }

  private generateFallbackResponse(userMessage: string, systemPrompt: string): string {
    const msg = userMessage.toLowerCase();
    
    // Check for off-topic warning
    if (systemPrompt.toLowerCase().includes("off-topic") && 
        (msg.includes("game") || msg.includes("anime") || msg.includes("hack") || msg.includes("shoot"))) {
      return "That sounds interesting, but remember we are here to explore our storybook about AI Ethics together! Let's stay on topic and read about how AI can help us responsibly 🌟.";
    }

    if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey")) {
      return "Hello young friend! I am your AI learning assistant. I am so excited to read and discuss today's storybook with you! What questions do you have? Chat with me! ✨";
    }

    if (msg.includes("who are you") || msg.includes("your name")) {
      return "I am your magical AI learning helper today! I am here to discuss ethics, safety, and fun puzzles about computers and AI! 🤖";
    }

    if (msg.includes("what is ai") || msg.includes("definition")) {
      return "AI stands for Artificial Intelligence! It is like giving computers a special set of instructions so they can learn from examples, recognise patterns, and help us solve problems—similar to our own brains, but on a digital screen! 💻";
    }

    return `That is a wonderful question! I am in offline mode right now, but we are learning so much about AI together. Let's keep exploring! 🚀`;
  }
}

export const geminiQueue = new GeminiRequestQueue();
