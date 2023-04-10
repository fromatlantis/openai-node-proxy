const bodyParser = require("body-parser");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { Configuration, OpenAIApi } = require("openai");
const { encode } = require("gpt-3-encoder");

const PORT = 3000;
const MAX_TOKENS = process.env.MAX_TOKENS || 512;

// const LIMITER_MSG = "Too many requests from this IP, please try again later.";
const LIMITER_MSG =
  "当前访问量过多，请稍后再试。如有需要请联系作者微信号：lomo-pis。";
const CHAT_LIMITER = process.env.CHAT_LIMITER || 9;
const IMAGE_LIMITER = process.env.IMAGE_LIMITER || 3;

const app = express();

app.set("trust proxy", 1);

app.use(bodyParser.json());

const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openaiClient = new OpenAIApi(openaiConfig);

app.get("/hello", async (req, res) => {
  res.send("world");
});

const chatLimiter = rateLimit({
  windowMs: 3 * 60 * 60 * 1000, // 3 hoour
  max: CHAT_LIMITER,
  keyGenerator: (request, response) => {
    console.log(request.ip, request.body.messages[0].content);
    return request.ip;
  },
  message: {
    error: {
      message: LIMITER_MSG,
    },
  },
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
    res.status(500).send(error);
  }
});

const imageLimiter = rateLimit({
  windowMs: 3 * 60 * 60 * 1000, // 3 hoour
  max: IMAGE_LIMITER,
  keyGenerator: (request, response) => {
    console.log(request.ip, `image->${request.body.prompt}s`);
    return request.ip;
  },
  message: {
    error: {
      message: LIMITER_MSG,
    },
  },
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
    res.status(500).send(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
