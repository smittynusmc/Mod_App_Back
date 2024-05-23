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

console.log("Environment Variables:");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET);
console.log("GOOGLE_REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.get("/auth/google", (req, res) => {
  console.log("GET /auth/google called");
  const scopes = ["https://www.googleapis.com/auth/youtube.force-ssl"];
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI  // Ensure redirect_uri is included
  });
  console.log("Redirecting to:", url);
  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  console.log("GET /auth/google/callback called");
  const { code } = req.query;
  console.log("Authorization code received:", code);
  try {
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI  // Ensure redirect_uri is included
    });
    console.log("Tokens received:", tokens);
    oauth2Client.setCredentials(tokens);
    res.redirect(`https://themodapp-c75be.web.app/youtube-comments?access_token=${tokens.access_token}`);
  } catch (error) {
    console.error("Error getting tokens:", error);
    res.status(500).send("Authentication failed");
  }
});

app.post("/youtube/comments", async (req, res) => {
  console.log("POST /youtube/comments called");
  const { videoId, accessToken } = req.body;
  console.log("Received videoId:", videoId);
  console.log("Received accessToken:", accessToken);
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const response = await youtube.commentThreads.list({
      part: "snippet,replies",
      videoId,
    });
    console.log("Comment threads fetched successfully");
    res.json(response.data.items);
  } catch (error) {
    console.error("Error fetching comment threads:", error);
    if (error.response && error.response.data) {
      console.error("Error details:", error.response.data);
    }
    res.status(500).send("Failed to fetch comment threads");
  }
});

// Default route for checking server is running
app.get("/", (req, res) => {
  console.log("GET / called");
  res.send("Welcome to the YouTube Comments Backend!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
