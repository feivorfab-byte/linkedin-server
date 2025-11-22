const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const axios = require('axios');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Allow large payloads for images
app.use(express.json({ limit: '50mb' }));
// We relax helmet slightly to allow inline scripts for this simple UI
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const MODEL_NAME = 'claude-sonnet-4-5-20250929';

// --- THE BACKEND LOGIC (BRAIN) ---

async function callClaude(messages) {
  if (!CLAUDE_API_KEY) throw new Error("Server missing CLAUDE_API_KEY");
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    { model: MODEL_NAME, max_tokens: 2000, messages: messages },
    { headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } }
  );
  return response.data.content[0].text;
}

app.post('/api/analyze-images', async (req, res) => {
  try {
    const { images } = req.body;
    const prompt = `You are an expert trade show fabricator in Atlanta. Analyze these photos.
    Generate 3 distinct, deep technical questions that would help the fabricator tell the story of this build.
    Focus on: Materials used, specific engineering challenges, and fabrication techniques.
    Return ONLY a JSON array like this:
    [ { "id": 1, "text": "Question here?" }, { "id": 2, "text": "Question here?" }, { "id": 3, "text": "Question here?" } ]`;

    const messageContent = [{ type: "text", text: prompt }];
    images.forEach(img => {
      const base64Data = img.includes('base64,') ? img.split('base64,')[1] : img;
      messageContent.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Data } });
    });

    const responseText = await callClaude([{ role: "user", content: messageContent }]);
    const jsonMatch = responseText.match(/\[.*\]/s);
    res.json({ questions: jsonMatch ? JSON.parse(jsonMatch[0]) : [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-post', async (req, res) => {
  try {
    const { question, answer } = req.body;
    const prompt = `You are an expert technical storyteller with the practical wisdom of a master builder.
    TASK: Rewrite the following answer into a high-quality, narrative blog post.
    CONTEXT: Question: "${question}" | Answer: "${answer}"
    GUIDELINES:
    - Tone: Professional, insightful, grounded. Like a highly experienced fabricator.
    - Format: Structured blog post. NO EMOJIS. NO BULLET LISTS.
    - Use Markdown Headers (##) to separate sections.
    
    STRUCTURE:
    ## The Challenge
    [Narrative paragraph about constraints]
    ## The Solution
    [Detailed paragraph about fabrication/technique]
    ## The Result
    [Concluding paragraph about impact]
    
    Return ONLY the markdown text.`;

    const post = await callClaude([{ role: "user", content: [{ type: "text", text: prompt }] }]);
    res.json({ post });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- THE FRONTEND UI (FACE) ---

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Fabricator AI</title>
<style>
  /* APPLE DESIGN SYSTEM CSS */
  :root { --bg: #F2F2F7; --card: #FFFFFF; --blue: #007AFF; --text: #1C1C1E; --gray: #8E8E93; }
  body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 20px; -webkit-font-smoothing: antialiased; }
  .container { max-width: 600px; margin: 0 auto; }
  
  h1 { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 20px; text-align: center; }
  
  .card { background: var(--card); border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 20px; }
  .card-title { font-size: 17px; font-weight: 600; margin-bottom: 15px; color: var(--text); }
  
  /* Inputs */
  input[type="file"] { display: none; }
  .file-upload { display: flex; align-items: center; justify-content: center; height: 50px; background: #E5F1FF; color: var(--blue); border-radius: 10px; font-weight: 600; cursor: pointer; transition: 0.2s; }
  .file-upload:active { opacity: 0.7; }
  
  textarea { width: 100%; border: 1px solid #E5E5EA; border-radius: 8px; padding: 12px; font-size: 16px; font-family: inherit; box-sizing: border-box; -webkit-appearance: none; margin-top: 10px; }
  textarea:focus { outline: none; border-color: var(--blue); }

  /* Buttons */
  button { width: 100%; background: var(--blue); color: white; border: none; padding: 16px; font-size: 17px; font-weight: 600; border-radius: 12px; cursor: pointer; margin-top: 10px; }
  button:disabled { opacity: 0.5; }
  
  /* Loading Spinner */
  .spinner { display: none; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 1s ease-in-out infinite; margin: 0 auto; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Markdown Styling (Apple Notes Look) */
  .result-content h2 { font-size: 22px; font-weight: 700; margin-top: 25px; margin-bottom: 10px; letter-spacing: -0.01em; }
  .result-content p { font-size: 17px; line-height: 1.5; margin-bottom: 15px; color: #3A3A3C; }
  
  .hidden { display: none; }
</style>
</head>
<body>

<div class="container">
  <h1>Fabricator AI</h1>

  <div class="card" id="step1">
    <div class="card-title">1. Project Photos</div>
    <label class="file-upload">
      <span>Select Photos</span>
      <input type="file" id="imageInput" multiple accept="image/*" onchange="handleImageSelect()">
    </label>
    <div id="imageCount" style="text-align:center; margin-top:10px; color:var(--gray); font-size:14px;"></div>
    <button id="analyzeBtn" onclick="analyzeImages()" class="hidden">Analyze Project <div class="spinner" id="analyzeSpinner"></div></button>
  </div>

  <div class="card hidden" id="step2">
    <div class="card-title">2. Project Details</div>
    <div id="questionsContainer"></div>
  </div>

  <div class="card hidden" id="step3">
    <div class="card-title">3. The Story</div>
    <div id="resultOutput" class="result-content"></div>
    <button onclick="location.reload()" style="background:#E5E5EA; color:black; margin-top:20px;">Start New Project</button>
  </div>
</div>

<script>
  let selectedImages = [];
  let currentQuestions = [];

  function handleImageSelect() {
    const input = document.getElementById('imageInput');
    if (input.files.length > 0) {
      document.getElementById('analyzeBtn').classList.remove('hidden');
      document.getElementById('imageCount').innerText = input.files.length + " photo(s) selected";
      
      // Convert to Base64
      selectedImages = [];
      Array.from(input.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => selectedImages.push(e.target.result);
        reader.readAsDataURL(file);
      });
    }
  }

  async function analyzeImages() {
    const btn = document.getElementById('analyzeBtn');
    const spinner = document.getElementById('analyzeSpinner');
    btn.innerText = ""; btn.appendChild(spinner); spinner.style.display = "block"; btn.disabled = true;

    try {
      const res = await fetch('/api/analyze-images', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ images: selectedImages })
      });
      const data = await res.json();
      currentQuestions = data.questions;
      renderQuestions();
    } catch (e) {
      alert("Error analyzing images");
      btn.innerText = "Analyze Project"; btn.disabled = false;
    }
  }

  function renderQuestions() {
    document.getElementById('step1').classList.add('hidden');
    const container = document.getElementById('step2');
    const qBox = document.getElementById('questionsContainer');
    container.classList.remove('hidden');
    
    qBox.innerHTML = "";
    currentQuestions.forEach((q, index) => {
      const div = document.createElement('div');
      div.style.marginBottom = "20px";
      div.innerHTML = \`
        <div style="font-weight:500; margin-bottom:5px; color:#007AFF">\${q.text}</div>
        <textarea id="answer-\${index}" rows="3" placeholder="Type your answer..."></textarea>
        <button onclick="generatePost(\${index})">Generate Section <div class="spinner" id="spin-\${index}"></div></button>
        <hr style="border:0; border-top:1px solid #E5E5EA; margin:20px 0;">
      \`;
      qBox.appendChild(div);
    });
  }

  async function generatePost(index) {
    const answer = document.getElementById('answer-'+index).value;
    const btn = event.target; 
    btn.innerText = "Generating..."; btn.disabled = true;

    try {
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ question: currentQuestions[index].text, answer: answer })
      });
      const data = await res.json();
      
      // Show Result
      document.getElementById('step2').classList.add('hidden');
      document.getElementById('step3').classList.remove('hidden');
      
      // Simple Markdown Parsing for the Apple Look
      let html = data.post
        .replace(/^## (.*$)/gim, '<h2>$1</h2>') // Convert ## Headers
        .replace(/\\n/g, '<br>'); // Convert newlines
      
      document.getElementById('resultOutput').innerHTML = html;
      
    } catch (e) {
      alert("Error generating post");
      btn.innerText = "Generate Section"; btn.disabled = false;
    }
  }
</script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
