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

const fetchAllComments = async (youtube, videoId, maxResults, pageToken = "", totalComments = []) => {
  try {
    const response = await youtube.commentThreads.list({
      part: "snippet,replies",
      videoId,
      pageToken,
      maxResults: Math.min(maxResults, 100), // Fetch up to 100 comments per request
    });

    let comments = response.data.items;
    totalComments = totalComments.concat(comments);

    // If we have fetched enough comments, return them
    if (totalComments.length >= maxResults) {
      return totalComments.slice(0, maxResults);
    }

    // If there's a next page and we haven't fetched enough comments, fetch the next page
    if (response.data.nextPageToken) {
      const nextPageComments = await fetchAllComments(youtube, videoId, maxResults, response.data.nextPageToken, totalComments);
      return nextPageComments;
    }

    // Return the accumulated comments
    return totalComments;
  } catch (error) {
    console.error("Error fetching comments:", error);
    if (error.response && error.response.data) {
      console.error("Error details:", error.response.data);
      if (error.response.data.error && error.response.data.error.code === 404) {
        throw new Error("Video not found");
      }
    }
    throw error;
  }
};

app.post("/youtube/comments", async (req, res) => {
  console.log("POST /youtube/comments called");
  const { videoId, accessToken, maxResults } = req.body;
  console.log("Received videoId:", videoId);
  console.log("Received accessToken:", accessToken);
  console.log("Received maxResults:", maxResults);
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const allComments = await fetchAllComments(youtube, videoId, maxResults);
    console.log("All comment threads fetched successfully");
    res.json(allComments);
  } catch (error) {
    console.error("Error fetching comment threads:", error.message);
    if (error.message === "Video not found") {
      res.status(404).send("Video not found");
    } else {
      res.status(500).send("Failed to fetch comment threads");
    }
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
