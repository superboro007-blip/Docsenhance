import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Helper to execute generateContent with automatic retry and model fallback on 503/429 spikes
async function generateContentWithRetry(ai: GoogleGenAI, params: any) {
  // Try gemini-2.5-flash first as primary high-throughput model, followed by pro and flash variants
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3.7-flash",
  ];
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err || "");
        const status = err?.status || err?.code;
        const isTemporary =
          status === 503 ||
          status === 429 ||
          status === 500 ||
          status === "UNAVAILABLE" ||
          errMsg.includes("503") ||
          errMsg.includes("429") ||
          errMsg.includes("high demand") ||
          errMsg.includes("temporarily unavailable") ||
          errMsg.includes("try again later");

        if (isTemporary && attempt === 0) {
          // Quick wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        // Move to fallback model
        break;
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // AI Detect Card Side & Face/Card Boundary
  app.post("/api/ai/detect-card-side", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 in request body" });
      }

      const ai = getAiClient();
      if (!ai) {
        // Fallback response if no API key
        return res.json({
          side: "front",
          cardType: "id_card",
          detectedFace: true,
          cropBox: { yMin: 0.05, xMin: 0.05, yMax: 0.95, xMax: 0.95 },
          suggestedRotation: 0,
          summary: "Local inspection: ID Card front layout ready for cropping",
          fallback: true,
        });
      }

      // Clean base64 string
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

      const prompt = `Analyze this image for an ID Card & Passport Photo studio tool.
Determine:
1. Is this an ID card or badge? Determine which side it represents:
   - "front": Contains a cardholder portrait photograph / face, full name, card title/header, issue/expiry dates, or national/employee emblem.
   - "back": Contains address details, barcode, QR code, magnetic stripe, terms & conditions, signature strip, or emergency info WITHOUT a primary portrait photo.
   - "ambiguous": Unclear, blurry, dark, no discernible face OR barcode/address, or containing conflicting elements (confidence < 0.75).
   - "unknown": Not an ID card or unrecognizable object.
2. Is the detection ambiguous? (e.g. low resolution, unusual badge format, no clear photo or barcode, or confidence < 0.75). If so, provide the reason in ambiguityReason.
3. Detect if a person's face/head is present (detectedFace: true/false).
4. Detect if barcodes, QR codes, or address blocks are present (detectedBarcodeOrAddress: true/false).
5. Detect card bounding box in normalized coordinates (0-1000 scale: yMin, xMin, yMax, xMax).
6. Check if image is rotated (0, 90, 180, 270 degrees clockwise to orient right-side up).

Return strict JSON matching the schema.`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.7-flash",
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              side: {
                type: Type.STRING,
                description: "front, back, ambiguous, or unknown",
              },
              isAmbiguous: {
                type: Type.BOOLEAN,
                description: "True if detection confidence is low (< 0.75) or side is unclear",
              },
              ambiguityReason: {
                type: Type.STRING,
                description: "Explanation of why side classification is ambiguous or uncertain",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence score between 0.0 and 1.0",
              },
              cardType: {
                type: Type.STRING,
                description: "id_card, driver_license, national_id, aadhaar, passport_page, badge, or other",
              },
              detectedFace: {
                type: Type.BOOLEAN,
                description: "Whether a distinct portrait face was detected",
              },
              detectedBarcodeOrAddress: {
                type: Type.BOOLEAN,
                description: "Whether barcodes, QR codes, magnetic stripes, or address blocks were detected",
              },
              summary: {
                type: Type.STRING,
                description: "Brief clear description, e.g. 'Front side ID card with photo and name header'",
              },
              suggestedRotation: {
                type: Type.INTEGER,
                description: "0, 90, 180, or 270 degrees clockwise to make it right-side up",
              },
              cardBoundingBox: {
                type: Type.OBJECT,
                properties: {
                  yMin: { type: Type.NUMBER },
                  xMin: { type: Type.NUMBER },
                  yMax: { type: Type.NUMBER },
                  xMax: { type: Type.NUMBER },
                },
              },
              faceBoundingBox: {
                type: Type.OBJECT,
                properties: {
                  yMin: { type: Type.NUMBER },
                  xMin: { type: Type.NUMBER },
                  yMax: { type: Type.NUMBER },
                  xMax: { type: Type.NUMBER },
                },
              },
            },
            required: ["side", "isAmbiguous", "confidence", "cardType", "detectedFace", "summary"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (err: any) {
      console.warn("AI Detect Side service note (falling back to manual choice mode):", err?.message || err);
      return res.json({
        side: "ambiguous",
        isAmbiguous: true,
        confidence: 0.5,
        ambiguityReason: "AI service temporarily experiencing high demand. Please verify if this image is the Front or Back side.",
        cardType: "id_card",
        detectedFace: false,
        summary: "Side ambiguous (Please select Front or Back manually)",
        fallback: true,
      });
    }
  });

  // AI Passport Auto-Crop and Framing
  app.post("/api/ai/passport-crop-assistant", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", targetRatio = "35x45" } = req.body;
      const ai = getAiClient();
      if (!ai || !imageBase64) {
        return res.json({
          cropBox: { x: 10, y: 5, width: 80, height: 90 },
          facePosition: "centered",
          recommendation: "Crop box positioned with head centered",
        });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      const prompt = `You are an expert passport and biometric photo assistant. 
Find the person's face and return ideal crop box percentage coordinates (0 to 100) for standard ${targetRatio} passport photo where:
- The head (from crown of hair to chin) occupies 70% to 80% of photo height.
- The face and eyes are horizontally centered.
- Sufficient margin (approx 8-10%) above the hair crown.
- Aspect ratio is matched.`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.7-flash",
        contents: [
          { inlineData: { data: cleanBase64, mimeType } },
          { text: prompt },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cropBox: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER, description: "Left percentage 0-100" },
                  y: { type: Type.NUMBER, description: "Top percentage 0-100" },
                  width: { type: Type.NUMBER, description: "Width percentage 0-100" },
                  height: { type: Type.NUMBER, description: "Height percentage 0-100" },
                },
                required: ["x", "y", "width", "height"],
              },
              headHeightPercentage: { type: Type.NUMBER },
              complianceCheck: {
                type: Type.OBJECT,
                properties: {
                  eyesVisible: { type: Type.BOOLEAN },
                  frontalPose: { type: Type.BOOLEAN },
                  neutralExpression: { type: Type.BOOLEAN },
                  lightingQuality: { type: Type.STRING },
                  backgroundQuality: { type: Type.STRING },
                },
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["cropBox"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (err: any) {
      console.warn("AI Passport Crop note (using standard framing fallback):", err?.message || err);
      return res.json({
        cropBox: { x: 10, y: 5, width: 80, height: 90 },
        recommendations: ["Positioned standard portrait framing"],
      });
    }
  });

  // AI Background Segmentation & Analysis Endpoint
  app.post("/api/ai/remove-background", async (req, res) => {
    try {
      const { imageBase64, targetBgColor = "transparent", mimeType = "image/jpeg" } = req.body;
      const ai = getAiClient();
      if (!ai || !imageBase64) {
        return res.json({
          status: "fallback",
          message: "Client-side smart background removal active",
          targetBgColor,
        });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      const prompt = `Analyze this portrait/document photo to assist with background removal.
Identify:
1. The dominant background color in hex format (e.g. #f4f4f4, #ffffff, #2a3b4c).
2. The bounding box of the main person or card subject in normalized coordinates (0-1000 scale).
3. The lighting uniformity and background complexity (plain, gradient, textured, outdoor).
4. Edge sharpness recommendation (soft, medium, hard).`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: [
          { inlineData: { data: cleanBase64, mimeType } },
          { text: prompt },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedBgHex: { type: Type.STRING },
              subjectBounds: {
                type: Type.OBJECT,
                properties: {
                  yMin: { type: Type.NUMBER },
                  xMin: { type: Type.NUMBER },
                  yMax: { type: Type.NUMBER },
                  xMax: { type: Type.NUMBER },
                },
              },
              backgroundType: { type: Type.STRING },
              recommendedTolerance: { type: Type.NUMBER },
            },
            required: ["detectedBgHex"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json({
        status: "ok",
        analysis: parsed,
        targetBgColor,
      });
    } catch (err: any) {
      console.warn("AI Remove Background note:", err?.message || err);
      return res.json({
        status: "fallback",
        message: "Applied fast local smart segmentation",
      });
    }
  });

  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Passport & ID Studio Server running on http://localhost:${PORT}`);
  });
}

startServer();
