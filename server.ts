import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { sendPendingEmail, sendConfirmationEmail, sendTestEmail } from "./server/mailer";

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

// Initialize Google GenAI client (lazy loaded to prevent crash when deployed without key)
let aiInstance: GoogleGenAI | null = null;
function getAi() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

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

    const response = await getAi().models.generateContent({
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

    const response = await getAi().models.generateContent({
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

app.post("/api/email/test", async (req, res) => {
  try {
    const { to, subject, body, smtpConfig } = req.body;
    const result = await sendTestEmail(to, subject, body, smtpConfig);
    res.json(result);
  } catch (err) {
    console.error("Test email API error:", err);
    res.status(500).json({ 
      error: "Failed to send test email", 
      details: err instanceof Error ? err.message : String(err) 
    });
  }
});

// Helper function to safely fetch and parse JSON responses, preventing SyntaxError on non-JSON or empty content
async function safeFetchJson(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      data = { error: text || `Status: ${response.status} ${response.statusText}` };
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

// WhatsApp API dispatcher
app.post("/api/whatsapp/send", async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: "Phone and message are required." });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");

    // 1. Meta WhatsApp Cloud API credentials
    const metaToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const metaPhoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

    // 2. Twilio WhatsApp credentials
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

    // 3. WAHA (WhatsApp HTTP API) Configuration
    const wahaApiUrlOverride = req.headers["x-waha-url-override"] as string;
    const wahaApiKeyOverride = req.headers["x-waha-key-override"] as string;
    const wahaSessionOverride = req.headers["x-waha-session-override"] as string;

    const wahaApiUrl = wahaApiUrlOverride || process.env.WAHA_API_URL || "https://devlikeaprowaha-production-5bc7.up.railway.app";
    const wahaApiKey = wahaApiKeyOverride !== undefined ? (wahaApiKeyOverride === "none" ? "" : wahaApiKeyOverride) : process.env.WAHA_API_KEY;
    const wahaSession = wahaSessionOverride || process.env.WAHA_SESSION || "default";

    // Detect which provider to use
    const hasMeta = !!(metaToken && metaPhoneId);
    const hasTwilio = !!(twilioSid && twilioAuthToken && twilioFrom);
    
    // Default to WAHA if WAHA_API_URL is specified, or if an override URL is supplied, or if neither Meta nor Twilio are configured
    const useWaha = !!wahaApiUrlOverride || !!process.env.WAHA_API_URL || (!hasMeta && !hasTwilio);

    if (useWaha) {
      // Send using WAHA API
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (wahaApiKey && wahaApiKey !== "none") {
        headers["X-Api-Key"] = wahaApiKey;
        headers["Authorization"] = `Bearer ${wahaApiKey}`;
      }

      // If wahaApiUrl is pointing to localhost:3000, prevent self-referential loop that triggers 404
      if (wahaApiUrl.includes("localhost:3000") || wahaApiUrl.includes("127.0.0.1:3000")) {
        throw new Error(
          "WAHA_API_URL is configured to localhost:3000 (which is the current web application port). " +
          "Please specify the correct port or external URL where your WAHA container is running."
        );
      }

      const { ok, status, data } = await safeFetchJson(`${wahaApiUrl}/api/sendText`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chatId: `${cleanPhone}@c.us`,
          text: message,
          session: wahaSession
        })
      });

      if (!ok) {
        throw new Error(data.message || data.error || `WAHA API responded with status ${status}`);
      }

      return res.json({ success: true, provider: "waha", data });
    } else if (hasMeta) {
      // Send using Meta Cloud API
      const { ok, status, data } = await safeFetchJson(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${metaToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: {
            preview_url: false,
            body: message
          }
        })
      });

      if (!ok) {
        throw new Error(data.error?.message || data.message || data.error || `Meta API responded with status ${status}`);
      }

      return res.json({ success: true, provider: "meta", data });
    } else if (hasTwilio) {
      // Send using Twilio API
      const authHeader = `Basic ${Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64')}`;
      const params = new URLSearchParams();
      params.append("To", `whatsapp:+${cleanPhone}`);
      params.append("From", `whatsapp:${twilioFrom}`);
      params.append("Body", message);

      const { ok, status, data } = await safeFetchJson(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });

      if (!ok) {
        throw new Error(data.message || data.error || `Twilio API responded with status ${status}`);
      }

      return res.json({ success: true, provider: "twilio", data });
    } else {
      // Fallback for non-configured states
      return res.status(412).json({
        success: false,
        error: "WhatsApp API credentials are not configured.",
        instructions: "Please define WAHA credentials, Meta WhatsApp Cloud API credentials, or Twilio credentials in your server environment variables.",
        wahaEnv: ["WAHA_API_URL", "WAHA_API_KEY", "WAHA_SESSION"],
        metaEnv: ["META_WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_PHONE_NUMBER_ID"],
        twilioEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"]
      });
    }
  } catch (error) {
    console.error("WhatsApp Send Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to dispatch WhatsApp message via API.",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// WAHA Connection Status check proxy
app.get("/api/whatsapp/status", async (req, res) => {
  const wahaApiUrlOverride = req.headers["x-waha-url-override"] as string;
  const wahaApiKeyOverride = req.headers["x-waha-key-override"] as string;
  const wahaSessionOverride = req.headers["x-waha-session-override"] as string;

  const wahaApiUrl = wahaApiUrlOverride || process.env.WAHA_API_URL || "https://devlikeaprowaha-production-5bc7.up.railway.app";
  const wahaApiKey = wahaApiKeyOverride !== undefined ? (wahaApiKeyOverride === "none" ? "" : wahaApiKeyOverride) : process.env.WAHA_API_KEY;
  const wahaSession = wahaSessionOverride || process.env.WAHA_SESSION || "default";

  console.log(`[WAHA STATUS CHECK] URL: ${wahaApiUrl}, Session: ${wahaSession}`);
  console.log(`[WAHA STATUS CHECK] API Key Loaded: ${!!wahaApiKey} (Length: ${wahaApiKey ? wahaApiKey.length : 0})`);
  if (wahaApiKey) {
    console.log(`[WAHA STATUS CHECK] API Key starts with: "${wahaApiKey.substring(0, 10)}..."`);
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (wahaApiKey && wahaApiKey !== "none") {
      headers["X-Api-Key"] = wahaApiKey;
      headers["Authorization"] = `Bearer ${wahaApiKey}`;
    }

    if (wahaApiUrl.includes("localhost:3000") || wahaApiUrl.includes("127.0.0.1:3000")) {
      throw new Error(
        "WAHA_API_URL is configured to localhost:3000 (which is the current web application port). " +
        "Please specify the correct port or external URL where your WAHA container is running."
      );
    }

    const { ok, status, data } = await safeFetchJson(`${wahaApiUrl}/api/sessions`, {
      method: "GET",
      headers
    });

    if (!ok) {
      throw new Error(`WAHA returned status ${status}: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
    }

    const sessions = Array.isArray(data) ? data : [];
    // Find matching session
    const currentSession = sessions.find((s: any) => s.name === wahaSession || s.id === wahaSession);

    if (currentSession) {
      return res.json({
        success: true,
        connected: currentSession.status === "WORKING" || currentSession.status === "CONNECTED",
        status: currentSession.status,
        session: currentSession,
        allSessions: sessions,
        wahaApiUrl
      });
    } else {
      return res.json({
        success: true,
        connected: false,
        status: "NOT_FOUND",
        error: `Session '${wahaSession}' not found in WAHA.`,
        allSessions: sessions,
        wahaApiUrl
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      connected: false,
      status: "UNREACHABLE",
      error: error instanceof Error ? error.message : String(error),
      wahaApiUrl
    });
  }
});

// Export app for serverless deployment (e.g., Vercel)
export default app;

// Vite middleware / asset routing
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res) => {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
        res.set("Surrogate-Control", "no-store");
      }
    }));
    app.get("*", (req, res) => {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.set("Surrogate-Control", "no-store");
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
