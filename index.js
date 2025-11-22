const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
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

  try {
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
    
    // Check for refusal
    if (response.data?.stop_reason === 'refusal') {
      console.error("Claude refused the request:", JSON.stringify(response.data));
      throw new Error("Claude was unable to process this request. Please try different images.");
    }
    
    if (!response.data?.content?.[0]?.text) {
      console.error("Unexpected API response:", JSON.stringify(response.data));
      throw new Error("Unexpected response format from Claude API");
    }
    
    return response.data.content[0].text;
  } catch (error) {
    if (error.response) {
      console.error("Claude API Error:", error.response.status, JSON.stringify(error.response.data));
      throw new Error(`Claude API Error: ${error.response.data?.error?.message || error.message}`);
    }
    throw error;
  }
}

// --- ROUTES ---

app.post('/api/analyze-images', async (req, res) => {
  try {
    const { images, promptModifier } = req.body;
    
    if (!images || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }
    
    const systemPrompt = `You are a helpful assistant for a professional fabrication and manufacturing company. You help analyze photos of completed projects (trade show displays, custom builds, signage, etc.) to generate engaging LinkedIn content. Always provide helpful, professional responses.`;
    
    const userPrompt = `Please analyze these photos of our completed fabrication/manufacturing project. We want to create a LinkedIn post showcasing our work.

Generate 3 thoughtful questions for the project manager to answer that will help create an engaging post.

Focus areas:
1. Technical challenges or innovative solutions
2. Materials and construction methods used  
3. Installation process or client collaboration

${promptModifier ? `Additional context: ${promptModifier}` : ''}

Return ONLY a JSON array in this exact format:
[
  { "id": 1, "category": "Technical", "text": "Your question here?" },
  { "id": 2, "category": "Materials", "text": "Your question here?" },
  { "id": 3, "category": "Process", "text": "Your question here?" }
]`;

    const messageContent = [{ type: "text", text: userPrompt }];
    
    images.forEach((img, index) => {
      try {
        const base64Data = img.includes('base64,') ? img.split('base64,')[1] : img;
        // Detect media type from data URL if possible
        let mediaType = "image/jpeg";
        if (img.includes('data:image/png')) mediaType = "image/png";
        else if (img.includes('data:image/webp')) mediaType = "image/webp";
        else if (img.includes('data:image/gif')) mediaType = "image/gif";
        
        messageContent.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64Data }
        });
      } catch (imgError) {
        console.error(`Error processing image ${index}:`, imgError.message);
      }
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
      systemPrompt
    );
    
    res.json({ post });
  } catch (error) {
    console.error("Generation Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refine-post', async (req, res) => {
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
      systemPrompt
    );
    
    res.json({ post: revisedPost });
  } catch (error) {
    console.error("Refinement Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
