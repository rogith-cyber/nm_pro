require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const connectDB = require("./src/utils/db");
const fs = require("fs");
const path = require("path");

const app = express();

if(!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Middleware
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// Routes
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/materials", require("./src/routes/materials"));
app.use("/api/material", require("./src/routes/materials"));
app.use("/api/admin", require("./src/routes/admin"));

// Health check
app.get("/", (req, res) => res.json({ message: "AI StudyBuddy API is running", status: "ok" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.warn("MongoDB Atlas connection notice:", err.message);
  app.listen(PORT, () => console.log(`Server running on port ${PORT} (API ready)`));
});
