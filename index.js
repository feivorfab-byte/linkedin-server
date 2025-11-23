// =====================================================
//  SERVER SETUP
// =====================================================
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const HISTORY_FILE = path.join(__dirname, "post-history.json");

// =====================================================
//  MODEL SETUP
// =====================================================
const IMAGE_MODEL = "claude-sonnet-4-20250514";
const TEXT_MODEL = "claude-sonnet-4-20250514";

// =====================================================
//  HELPER: Load/Save History
// =====================================================
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading history:", error);
  }
  return [];
}

function saveToHistory(entry) {
  try {
    const history = loadHistory();
    history.unshift(entry); // Add to beginning
    if (history.length > 100) history.pop(); // Keep only last 100
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error("Error saving to history:", error);
  }
}

// =====================================================
//  HELPER: Get Tone Prompt
// =====================================================
function getTonePrompt(tone) {
  const toneMap = {
    technical: "Write in a highly technical style. Use industry terminology, explain complex processes in detail, and focus on engineering decisions. Your audience is experienced professionals.",
    balanced: "Write in a balanced style that mixes technical detail with storytelling. Explain the technical aspects but make them accessible to a broader audience.",
    accessible: "Write in an accessible, storytelling style. Focus on the narrative and journey. Explain technical concepts in simple terms that anyone can understand."
  };
  return toneMap[tone] || toneMap.balanced;
}

// =====================================================
//  HELPER: Get Length Settings
// =====================================================
function getLengthSettings(length) {
  const lengthMap = {
    short: { words: "150 to 200", tokens: 1500 },
    medium: { words: "300 to 400", tokens: 3000 },
    long: { words: "500 to 600", tokens: 4000 }
  };
  return lengthMap[length] || lengthMap.medium;
}

// =====================================================
//  BASE CLAUDE CALLER
// =====================================================
async function callClaude(messages, systemPrompt, modelName, maxTokens = 3000) {
  if (!CLAUDE_API_KEY)
    throw new Error("Missing CLAUDE_API_KEY in environment.");

  const payload = {
    model: modelName,
    max_tokens: maxTokens,
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
//  ROUTE: ANALYZE IMAGES (Enhanced with hashtag generation)
// =====================================================
app.post("/api/analyze-images", async (req, res) => {
  try {
    const { images, promptModifier } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    const systemPrompt = `You are a Lead Fabricator. Analyze photos to extract technical details and identify relevant topics for social media.`;

    const userPrompt = `Analyze these project photos for a LinkedIn post.

Part 1: Generate 3 distinct questions for the builder to answer.
Focus on: 1. Technical Challenges 2. Material Specs 3. Installation Logistics.
${promptModifier ? `\n\nADDITIONAL INSTRUCTION: ${promptModifier}` : ""}

Part 2: Based on what you see in the images, suggest 5 to 8 relevant hashtags related to:
- Specific materials or techniques visible
- Industry or trade (fabrication, metalwork, woodwork, etc.)
- Business aspects (Atlanta, custom work, etc.)

Return ONLY a JSON object like this:
{
  "questions": [
    { "id": 1, "category": "Technical", "text": "Question goes here?" },
    { "id": 2, "category": "Materials", "text": "Question goes here?" },
    { "id": 3, "category": "Process", "text": "Question goes here?" }
  ],
  "hashtags": ["#maker", "#fabrication", "#atlanta", "#customwork", "#metalwork"]
}`;

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

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [], hashtags: [] };

    res.json(result);
  } catch (error) {
    console.error("Analysis Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
//  ROUTE: GENERATE POST (Enhanced with tone and length)
// =====================================================
app.post("/api/generate-post", async (req, res) => {
  try {
    const { question, answer, tone = "balanced", length = "medium", hashtags = [] } = req.body;

    const tonePrompt = getTonePrompt(tone);
    const lengthSettings = getLengthSettings(length);

    const systemPrompt = `You are a Master Fabricator and storyteller. Your writing style is enthusiastic, technical, and accessible (like Adam Savage). You write detailed, engaging narratives that bring readers into the shop floor experience.

Traits: 
- Geek out on technical details and explain the "why" behind every decision
- Use active verbs and vivid descriptions
- No corporate jargon
- Never use hyphens in your writing. Use alternative phrasing instead.
- Write in a conversational but professional tone
- Include specific details about materials, processes, and problem solving

TONE INSTRUCTION: ${tonePrompt}`;

    const hashtagString = hashtags.length > 0 
      ? hashtags.join(" ") 
      : "#maker #fabrication #tradeshows #buildprocess #atlantabusiness";

    const prompt = `
Write a detailed, engaging LinkedIn post based on this interaction. The post should be approximately ${lengthSettings.words} words.

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
- Hashtags at the end: ${hashtagString}
- IMPORTANT: Do not use any hyphens in your writing. Reword phrases to avoid them entirely.

Write a thorough, detailed post that showcases expertise and brings the reader into the experience.
`;

    const post = await callClaude(
      [{ role: "user", content: [{ type: "text", text: prompt }] }],
      systemPrompt,
      TEXT_MODEL,
      lengthSettings.tokens
    );

    res.json({ post });
  } catch (error) {
    console.error("Generation Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
//  ROUTE: GENERATE VARIATIONS (3 different approaches)
// =====================================================
app.post("/api/generate-variations", async (req, res) => {
  try {
    const { question, answer, length = "medium", hashtags = [] } = req.body;

    const lengthSettings = getLengthSettings(length);
    const hashtagString = hashtags.length > 0 
      ? hashtags.join(" ") 
      : "#maker #fabrication #tradeshows #buildprocess #atlantabusiness";

    const variations = [
      {
        name: "Technical Deep Dive",
        tone: "technical",
        description: "Detailed technical explanation for industry professionals"
      },
      {
        name: "Storytelling",
        tone: "accessible",
        description: "Narrative focused post that emphasizes the journey"
      },
      {
        name: "Problem Solving",
        tone: "balanced",
        description: "Focuses on challenges overcome and lessons learned"
      }
    ];

    const results = [];

    for (const variant of variations) {
      const tonePrompt = getTonePrompt(variant.tone);
      
      const systemPrompt = `You are a Master Fabricator writing LinkedIn content.

Style: ${variant.description}

Never use hyphens in your writing. Use alternative phrasing instead.

TONE INSTRUCTION: ${tonePrompt}`;

      const prompt = `
Write a LinkedIn post (${lengthSettings.words} words) based on this interaction.

Question: "${question}"
Builder's Notes: "${answer}"

STYLE: ${variant.description}

REQUIREMENTS:
- Create a compelling hook
- ${variant.tone === "technical" ? "Focus on technical depth and engineering decisions" : ""}
- ${variant.tone === "accessible" ? "Tell the story in an engaging, accessible way" : ""}
- ${variant.tone === "balanced" ? "Focus on problem solving approach and key decisions" : ""}
- Use minimal emojis (maximum 2 total: ⚡️ or 🛠️)
- End with a call to action
- Hashtags: ${hashtagString}
- CRITICAL: Never use hyphens. Reword all phrases to avoid them.
`;

      const post = await callClaude(
        [{ role: "user", content: [{ type: "text", text: prompt }] }],
        systemPrompt,
        TEXT_MODEL,
        lengthSettings.tokens
      );

      results.push({
        name: variant.name,
        description: variant.description,
        post: post
      });
    }

    res.json({ variations: results });
  } catch (error) {
    console.error("Variations Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
//  ROUTE: SAVE POST TO HISTORY
// =====================================================
app.post("/api/save-post", async (req, res) => {
  try {
    const { question, answer, post, hashtags } = req.body;

    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      question,
      answer,
      post,
      hashtags: hashtags || []
    };

    saveToHistory(entry);

    res.json({ success: true, message: "Post saved to history" });
  } catch (error) {
    console.error("Save Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
//  ROUTE: GET POST HISTORY
// =====================================================
app.get("/api/get-history", async (req, res) => {
  try {
    const history = loadHistory();
    res.json({ history });
  } catch (error) {
    console.error("History Error:", error.message);
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
