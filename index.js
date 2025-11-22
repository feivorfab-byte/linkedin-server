const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const axios = require('axios');
const path = require('path');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// SERVE THE NEW UI
app.use(express.static('public'));

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const MODEL_NAME = 'claude-sonnet-4-5-20250929';

async function callClaude(messages, systemPrompt) {
  if (!CLAUDE_API_KEY) throw new Error("Server missing CLAUDE_API_KEY");
  
  const payload = {
    model: MODEL_NAME,
    max_tokens: 1500,
    messages: messages
  };

  if (systemPrompt) payload.system = systemPrompt;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    payload,
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.content[0].text;
}

// --- ROUTES ---

app.post('/api/analyze-images', async (req, res) => {
  try {
    const { images } = req.body;
    
    // System Prompt: Expert Analyst
    const systemPrompt = `You are a Lead Fabricator. Analyze photos to extract technical details.`;
    
    const userPrompt = `Analyze these project photos for a LinkedIn post.
    Generate 3 distinct questions for the builder to answer.
    Focus on: 1. Technical Challenges 2. Material Specs 3. Installation Logistics.
    
    Return ONLY a JSON array like this:
    [
      { "id": 1, "category": "Technical", "text": "How did you manage the weight distribution on that overhang?" },
      { "id": 2, "category": "Materials", "text": "..." },
      { "id": 3, "category": "Process", "text": "..." }
    ]`;

    const messageContent = [{ type: "text", text: userPrompt }];
    images.forEach(img => {
      const base64Data = img.includes('base64,') ? img.split('base64,')[1] : img;
      messageContent.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: base64Data }
      });
    });

    const responseText = await callClaude([{ role: "user", content: messageContent }], systemPrompt);
    const jsonMatch = responseText.match(/\[.*\]/s);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    res.json({ questions });
  } catch (error) {
    console.error("Analysis Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-post', async (req, res) => {
  try {
    const { question, answer } = req.body;
    
    // --- THE ADAM SAVAGE / MAKER PERSONA ---
    const systemPrompt = `You are a Master Fabricator and Storyteller. 
    Your writing style matches the enthusiasm and technical accessibility of Adam Savage (Mythbusters/Tested).
    
    CORE TRAITS:
    1. GEEK OUT: You love the details. You get excited about specific fasteners, clean welds, and clever engineering.
    2. ACCESSIBLE EXPERTISE: You explain complex fabrication concepts simply, so anyone can appreciate the work.
    3. PUZZLE SOLVER: You frame construction challenges as exciting puzzles that were solved.
    4. AUTHENTIC: No corporate jargon (synergy, leverage, etc.). Use words like "beast," "beautiful," "tricky," "solved."
    
    FORMAT:
    - Start with a "Hook" that highlights a specific detail or challenge.
    - Use short, punchy paragraphs.
    - End with genuine pride in the build.
    `;

    const prompt = `
    Write a LinkedIn post based on this interaction.
    
    CONTEXT:
    The Prompt Question: "${question}"
    The Builder's Notes: "${answer}"
    
    REQUIREMENTS:
    - Turn the builder's notes into a narrative.
    - If the builder mentions a problem, highlight how satisfying the solution was.
    - Use 1-2 specific emojis (like ⚡️, 🛠️, or 🧠) but don't overdo it.
    - Include these hashtags: #maker #fabrication #tradeshows #buildprocess #atlantabusiness
    `;

    const post = await callClaude(
      [{ role: "user", content: [{ type: "text", text: prompt }] }],
      systemPrompt
    );
    
    res.json({ post });
  } catch (error) {
    console.error("Generation Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
