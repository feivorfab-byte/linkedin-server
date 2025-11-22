const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const axios = require('axios');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// UPDATED: Using your available Sonnet 4.5 Model
const MODEL_NAME = 'claude-sonnet-4-5-20250929';

async function callClaude(messages) {
  if (!CLAUDE_API_KEY) throw new Error("Server missing CLAUDE_API_KEY");
  
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: MODEL_NAME,
      max_tokens: 1500,
      messages: messages
    },
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

app.get('/', (req, res) => {
  res.send('LinkedIn Generator API is Running 🚀');
});

app.post('/api/analyze-images', async (req, res) => {
  try {
    const { images, template } = req.body;
    const prompt = `You are an expert trade show fabricator in Atlanta. Analyze these photos.
    Context: The user wants to write a LinkedIn post about this project using the "${template || 'General'}" style.
    
    Generate 3 distinct, professional questions that the user (the fabricator) can answer to tell the story of this build.
    The questions should prompt for technical details, challenges overcome, or material specs.
    
    Return ONLY a JSON array like this:
    [
      { "id": 1, "text": "Question here?" },
      { "id": 2, "text": "Question here?" },
      { "id": 3, "text": "Question here?" }
    ]`;

    const messageContent = [{ type: "text", text: prompt }];
    
    images.forEach(img => {
      const base64Data = img.includes('base64,') ? img.split('base64,')[1] : img;
      messageContent.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: base64Data }
      });
    });

    const responseText = await callClaude([{ role: "user", content: messageContent }]);
    const jsonMatch = responseText.match(/\[.*\]/s);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    res.json({ questions });
  } catch (error) {
    console.error("Analysis Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-post', async (req, res) => {
  try {
    const { question, answer, template } = req.body;
    
    const prompt = `You are a professional LinkedIn Ghostwriter for a high-end trade show fabrication business.
    
    TASK: Rewrite the following casual answer into a professional, engaging LinkedIn post.
    
    CONTEXT:
    - Template Style: ${template || 'Standard'}
    - The Prompt: "${question}"
    - The User's Answer (Casual voice): "${answer}"
    
    GUIDELINES:
    - Tone: Expert, capable, slightly technical but accessible. NOT sales-y.
    - Formatting: Use short paragraphs, bullet points if needed.
    - Emoji usage: Minimal and professional (🔧, 🏗️, 🚀).
    - Ending: Include these hashtags: #tradeshows #customfabrication #exhibitdesign #eventprofs #atlantabusiness
    
    Return ONLY the post text.`;

    const post = await callClaude([{ role: "user", content: [{ type: "text", text: prompt }] }]);
    res.json({ post });
  } catch (error) {
    console.error("Generation Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
