const bodyParser = require("body-parser");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { Configuration, OpenAIApi } = require("openai");
const { encode } = require("gpt-3-encoder");

const PORT = 3000;
const MAX_TOKENS = process.env.MAX_TOKENS || 512;
const CHAT_LIMITER = process.env.CHAT_LIMITER || 9;
const IMAGE_LIMITER = process.env.IMAGE_LIMITER || 3;

const app = express();

app.use(bodyParser.json());

const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openaiClient = new OpenAIApi(openaiConfig);

app.get("/hello", async (req, res) => {
  const openaiRes = await openaiClient.createChatCompletion(
    {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "周杰伦出过哪些专辑？" }],
      stream: true
    },
    {
      responseType: "stream",
    }
  );
  openaiRes.data.pipe(res);
});

const chatLimiter = rateLimit({
  windowMs: 8 * 60 * 60 * 1000, // 8 hoour
  max: CHAT_LIMITER,
  message:
    "Too many requests created from this IP, please try again after 8 hour.",
});

app.post("/v1/chat/completions", chatLimiter, async (req, res) => {
  try {
    const tokensLength = req.body.messages.reduce((acc, cur) => {
      const length = encode(cur.content).length;
      return acc + length;
    }, 0);
    if (tokensLength > MAX_TOKENS) {
      res.status(500).send({
        error: {
          message: `max_tokens is limited: ${MAX_TOKENS}`,
        },
      });
    }
    const openaiRes = await openaiClient.createChatCompletion(req.body, {
      responseType: "stream",
    });
    openaiRes.data.pipe(res);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

const imageLimiter = rateLimit({
  windowMs: 8 * 60 * 60 * 1000, // 8 hoour
  max: IMAGE_LIMITER,
  message:
    "Too many requests created from this IP, please try again after an hour.",
});

app.post("/v1/images/generations", imageLimiter, async (req, res) => {
  try {
    const tokensLength = encode(req.body.prompt).length;
    if (tokensLength > MAX_TOKENS) {
      res.status(500).send({
        error: {
          message: `max_tokens is limited: ${MAX_TOKENS}`,
        },
      });
    }
    const openaiRes = await openaiClient.createImage(req.body);
    res.send(openaiRes.data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
