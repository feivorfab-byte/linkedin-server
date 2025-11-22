// =====================================================
//  SERVER SETUP
// =====================================================
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// =====================================================
//  TWO-MODEL SETUP
//  - IMAGE_MODEL: Claude 3.5 Sonnet for image analysis
//  - TEXT_MODEL: Claude 3.5 Sonnet for text generation
// =====================================================
const IMAGE_MODEL = "claude-sonnet-4-20250514";
const TEXT_MODEL = "claude-sonnet-4-20250514";

// =====================================================
//  BASE CLAUDE CALLER
// =====================================================
async function callClaude(messages, systemPrompt, modelName) {
  if (!CLAUDE_API_KEY)
    throw new Error("Missing CLAUDE_API_KEY in environment.");

  const payload = {
    model: modelName,
    max_tokens: 1500,
    messages,
  };

  if (systemPrompt) payload.system = systemPrompt;

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      payload,
      {
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data?.stop_reason === "refusal") {
      console.error("Claude refused:", JSON.stringify(response.data));
      throw new Error("Claude refused the request. Please try different content.");
    }

    if (!response.data?.content?.[0]?.text) {
      console.error("Unexpected response:", JSON.stringify(response.data));
      throw new Error("Unexpected Claude response format.");
    }

    return response.data.content[0].text;

  } catch (err) {
    if (err.response) {
      console.error("API Error:", err.response.status, JSON.stringify(err.response.data));
      throw new Error(
        `Claude API Error: ${err.response.data?.error?.message || err.message}`
      );
    }
    throw err;
  }
}

// =====================================================
//  ROUTE: ANALYZE IMAGES
// =====================================================
app.post("/api/analyze-images", async (req, res) => {
  try {
    const { images, promptModifier } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    const systemPrompt = `You are a Lead Fabricator. Analyze photos to extract technical details.`;

    const userPrompt = `Analyze these project photos for a LinkedIn post.
Generate 3 distinct questions for the builder to answer.
Focus on: 1. Technical Challenges 2. Material Specs 3. Installation Logistics.
${promptModifier ? `\n\nADDITIONAL INSTRUCTION: ${promptModifier}` : ""}

Return ONLY a JSON array like this:
[
  { "id": 1, "category": "Technical", "text": "Question goes here?" },
  { "id": 2, "category": "Materials", "text": "Question goes here?" },
  { "id": 3, "category": "Process", "text": "Question goes here?" }
]`;

    const messageContent = [{ type: "text", text: userPrompt }];

    images.forEach((img) => {
      const base64Data = img.includes("base64,") ? img.split("base64,")[1] : img;
      let mediaType = "image/jpeg";
      if (img.includes("data:image/png")) mediaType = "image/png";
      else if (img.includes("data:image/webp")) mediaType = "image/webp";
      else if (img.includes("data:image/gif")) mediaType = "image/gif";

      messageContent.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64Data },
      });
    });

    const responseText = await callClaude(
      [{ role: "user", content: messageContent }],
      systemPrompt,
      IMAGE_MODEL
    );

    const jsonMatch = responseText.match(/\[.*\]/s);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    res.json({ questions });
  } catch (error) {
    console.error("Analysis Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
//  ROUTE: GENERATE POST
// =====================================================
app.post("/api/generate-post", async (req, res) => {
  try {
    const { question, answer } = req.body;

    const systemPrompt = `You are a Master Fabricator. Your writing style is enthusiastic, technical, and accessible (like Adam Savage).
Traits: Geek out on details, use active verbs, no corporate jargon.`;

    const prompt = `
Write a LinkedIn post based on this interaction.

Question: "${question}"
Builder's Notes: "${answer}"

REQUIREMENTS:
- Create a narrative hook.
- Explain the "How" and "Why".
- Use minimal emojis (⚡️, 🛠️).
- Hashtags: #maker #fabrication #tradeshows #buildprocess #atlantabusiness
`;

    const post = await callClaude(
      [{ role: "user", content: [{ type: "text", text: prompt }] }],
      systemPrompt,
      TEXT_MODEL
    );

    res.json({ post });
  } catch (error) {
    console.error("Generation Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
//  ROUTE: REFINE POST
// =====================================================
app.post("/api/refine-post", async (req, res) => {
  try {
    const { currentPost, refinementPrompt } = req.body;

    const systemPrompt = `You are a professional LinkedIn Ghostwriter specializing in fabrication and construction. Your task is to revise the provided LinkedIn post based on the user's instructions. Maintain the original professional, technical, and accessible tone.`;

    const prompt = `
Please revise the following LinkedIn post:

CURRENT POST:
---
${currentPost}
---

REFINEMENT INSTRUCTION: "${refinementPrompt}"

Return ONLY the revised post text. Do not add any conversational text or explanation.
`;

    const revisedPost = await callClaude(
      [{ role: "user", content: [{ type: "text", text: prompt }] }],
      systemPrompt,
      TEXT_MODEL
    );

    res.json({ post: revisedPost });
  } catch (error) {
    console.error("Refinement Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
//  START SERVER
// =====================================================
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
