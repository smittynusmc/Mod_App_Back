const express = require("express");
const { google } = require("googleapis");
const cors = require("cors");
const helmet = require("helmet");
require('dotenv').config();  // Load environment variables from .env file

const app = express();
app.use(cors());
app.use(express.json());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://apis.google.com"],
      connectSrc: ["'self'", "https://youtube-comments-backend-23opjzqi7q-uc.a.run.app"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  })
);

const PORT = process.env.PORT || 8080;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.get("/auth/google", (req, res) => {
  const scopes = ["https://www.googleapis.com/auth/youtube.readonly"];
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });
  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  res.redirect(`https://themodapp-c75be.web.app/youtube-comments?access_token=${tokens.access_token}`);
});

app.post("/youtube/comments", async (req, res) => {
  const { videoId, accessToken } = req.body;
  oauth2Client.setCredentials({ access_token: accessToken });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  const response = await youtube.commentThreads.list({
    part: "snippet",
    videoId,
  });

  res.json(response.data.items);
});

// Default route for checking server is running
app.get("/", (req, res) => {
  res.send("Welcome to the YouTube Comments Backend!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
