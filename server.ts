import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { sendPendingEmail, sendConfirmationEmail } from "./server/mailer";

const app = express();
const PORT = 3000;

app.use(express.json());

// Strict no-cache middleware for all HTTP responses
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});

// Initialize Google GenAI client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// AI endpoints
app.post("/api/ai/predict", async (req, res) => {
  try {
    const { schools, arrivalSlots } = req.body;
    
    // Create a dense summary representation of the registrations for the model
    const prompt = `Analyze the following SciVerse 2K26 Science Fair registration data to forecast congestion and bottleneck times:
- Registered Schools Data: ${JSON.stringify(schools || [])}
- Scheduled Arrival Slots Data: ${JSON.stringify(arrivalSlots || [])}

Perform the following tasks:
1. Review the schools scheduled at each arrival slot and calculate expected queue sizes.
2. Formulate 4-5 high-priority bottleneck alleviation directives (e.g. recommend shifting specific schools or adjusting security staff schedules).
3. Identify the single peak day with highest expected load.
4. Identify the single highest congestion half-hour interval.
5. Provide a mitigation urgency level (LOW, MEDIUM, HIGH, CRITICAL).

Please respond with a strictly formatted JSON object containing these exact fields:
- predictions: string (the full detailed analysis report with directives/recommendations)
- bottleneckDay: string (e.g. "Day 2 - Science Fair & Exhibitions")
- bottleneckTime: string (e.g. "08:30 AM - 09:00 AM")
- expectedPeakQueue: string (e.g. "120+ students at Main Gate")
- mitigationUrgency: string (e.g. "HIGH" or "CRITICAL")`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictions: { type: Type.STRING },
            bottleneckDay: { type: Type.STRING },
            bottleneckTime: { type: Type.STRING },
            expectedPeakQueue: { type: Type.STRING },
            mitigationUrgency: { type: Type.STRING }
          },
          required: [
            "predictions", 
            "bottleneckDay", 
            "bottleneckTime", 
            "expectedPeakQueue", 
            "mitigationUrgency"
          ]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error) {
    console.error("AI Predict Error:", error);
    res.status(500).json({ 
      error: "Failed to generate AI analytics predictions", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { question, schoolContext } = req.body;
    
    const prompt = `You are the SciVerse 2K26 AI Assistant, a friendly science-themed concierge for the Jaffna Hindu College Science Union registration portal.
Context:
- Event: SciVerse 2K26 School Registration & RSVP Portal (July 22, 23 & 24, 2026)
- July 23 and 24 are open for registrations, while July 22 is reserved for Inauguration & Launch.
- Maximum seating capacity: 1500 students per day.
- Organized by: Science Union of Jaffna Hindu College
- Current school context of the inquirer: ${JSON.stringify(schoolContext || "Not logged in / General inquiry")}

FAQ:
- Q: What is SciVerse 2K26?
  A: SciVerse 2K26 is the annual premier science exhibition, technology symposium, and competition series hosted by the Science Union of Jaffna Hindu College to inspire innovation among school students.
- Q: How do we register?
  A: Invited schools register first. Once approved by the administrator, the school receives a unique School Registration ID to log into their portal and add student and teacher participants.
- Q: What are the participant limits/quotas?
  A: Each approved school is allocated a specific quota of participants (e.g. 20-30 students/teachers) by the organizers to match seating and venue limits.
- Q: Is attendance tracked?
  A: Yes, every school and participant gets a unique QR Code pass which is scanned at the entrance.

Answer the following user question in a professional, welcoming, and futuristic tone. Keep the answer concise (under 120 words):
User: ${question}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ answer: response.text || "I'm sorry, I couldn't process your request." });
  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ 
      error: "AI assistant was unable to respond.", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Email dispatch endpoints
app.post("/api/email/pending", async (req, res) => {
  try {
    const schoolData = req.body;
    const result = await sendPendingEmail(schoolData);
    res.json(result);
  } catch (err) {
    console.error("Pending email API error:", err);
    res.status(500).json({ 
      error: "Failed to send pending email", 
      details: err instanceof Error ? err.message : String(err) 
    });
  }
});

app.post("/api/email/confirm", async (req, res) => {
  try {
    const schoolData = req.body;
    const result = await sendConfirmationEmail(schoolData);
    res.json(result);
  } catch (err) {
    console.error("Confirmation email API error:", err);
    res.status(500).json({ 
      error: "Failed to send confirmation email", 
      details: err instanceof Error ? err.message : String(err) 
    });
  }
});

// Export app for serverless deployment (e.g., Vercel)
export default app;

// Vite middleware / asset routing
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SciVerse 2K26 Server running on http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL !== "1") {
  initServer().catch(err => {
    console.error("Failed to start server:", err);
  });
}
