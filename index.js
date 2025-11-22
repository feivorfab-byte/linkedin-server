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
//  MODEL SETUP
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
    max_tokens: 3000,
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

    const systemPrompt = `You are a Master Fabricator and storyteller. Your writing style is enthusiastic, technical, and accessible (like Adam Savage). You write detailed, engaging narratives that bring readers into the shop floor experience.

Traits: 
- Geek out on technical details and explain the "why" behind every decision
- Use active verbs and vivid descriptions
- No corporate jargon
- Never use hyphens in your writing. Use alternative phrasing instead.
- Write in a conversational but professional tone
- Include specific details about materials, processes, and problem solving`;

    const prompt = `
Write a detailed, engaging LinkedIn post based on this interaction. The post should be substantial and thorough, approximately 300 to 400 words.

Question: "${question}"
Builder's Notes: "${answer}"

REQUIREMENTS:
- Create a compelling narrative hook that draws readers in
- Explain the technical "How" in detail, walking readers through the process
- Explain the "Why" behind key decisions
- Include specific details about materials, techniques, or challenges
- Share lessons learned or insights that other makers could apply
- Use minimal emojis (only ⚡️ or 🛠️ if needed, maximum 2 total)
- End with a thought provoking question or call to action for your audience
- Hashtags at the end: #maker #fabrication #tradeshows #buildprocess #atlantabusiness
- IMPORTANT: Do not use any hyphens in your writing. Reword phrases to avoid them entirely.

Write a thorough, detailed post that showcases expertise and brings the reader into the experience.
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

    const systemPrompt = `You are a professional LinkedIn Ghostwriter specializing in fabrication and construction. Your task is to revise the provided LinkedIn post based on the user's instructions. Maintain the original professional, technical, and accessible tone. Never use hyphens in your writing. Always reword phrases to avoid hyphens entirely.`;

    const prompt = `
Please revise the following LinkedIn post:

CURRENT POST:
---
${currentPost}
---

REFINEMENT INSTRUCTION: "${refinementPrompt}"

IMPORTANT RULES:
- Return ONLY the revised post text
- Do not add any conversational text or explanation
- Do not use any hyphens. Reword all phrases to avoid them.
- Maintain or increase the level of detail and length
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
