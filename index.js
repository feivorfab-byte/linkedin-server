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
// =====================================================
const IMAGE_MODEL = "claude-3-5-sonnet-20241022";
const TEXT_MODEL  = "claude-sonnet-4-5-20250929";

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
      throw new Error("Claude refused the request.");
    }

    if (!response.data?.content?.[0]?.text) {
      throw new Error("Unexpected Claude response format.");
    }

    return response.data.content[0].text;

  } catch (err) {
    if (err.response) {
      throw new Error(
        `Claude API Error: ${err.response.data?.error?.message || err.message}`
      );
    }
    throw err;
  }
}

// =====================================================
//  SAFE SYSTEM PROMPT FOR IMAGE ANALYSIS
// =============================
