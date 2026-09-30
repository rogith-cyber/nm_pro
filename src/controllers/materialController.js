const fs = require("fs");
const Material = require("../models/Material");
const { askGemini } = require("../utils/gemini");

// Helper: read uploaded file text safely
const readFileText = async (filePath, mimetype) => {
  try {
    if (filePath.endsWith(".pdf")) {
      try {
        const pdfParse = require("pdf-parse");
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text || fs.readFileSync(filePath, "utf-8");
      } catch (e) {
        return fs.readFileSync(filePath, "utf-8");
      }
    }
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    return "Study material content placeholder";
  }
};

const safeJsonArrayParse = (rawText, fallback = []) => {
  try {
    const clean = rawText.replace(/```json|```/g, "").trim();
    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    return JSON.parse(clean);
  } catch (e) {
    console.warn("JSON parsing fallback used for Gemini response:", e.message);
    return fallback;
  }
};

// POST /api/materials/upload
const uploadMaterial = async (req, res) => {
  if (!req.file && !req.body.content) {
    return res.status(400).json({ message: "No file or text content provided" });
  }

  const title = req.body.title || (req.file ? req.file.originalname : "Uploaded Material");
  let content = req.body.content || "";

  if (req.file) {
    content = await readFileText(req.file.path, req.file.mimetype);
    try {
      fs.unlinkSync(req.file.path);
    } catch {}
  }

  const material = await Material.create({
    user: req.user.userId,
    title,
    content,
    filename: req.file ? req.file.originalname : "direct_input.txt",
  });

  res.status(201).json({ message: "Material uploaded", material });
};

// GET /api/materials
const getMaterials = async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user.userId };
  const materials = await Material.find(filter).select("-content -flashcards -quiz -studyPlan").sort("-createdAt");
  res.json(materials);
};

// GET /api/materials/:id
const getMaterial = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json(material);
};

// DELETE /api/materials/:id
const deleteMaterial = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  await material.deleteOne();
  res.json({ message: "Deleted" });
};

// POST /api/materials/:id/summarize
const summarize = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  const prompt = `Summarize the following study material clearly and concisely in bullet points for quick student revision:\n\n${material.content}`;
  const summary = await askGemini(prompt);

  material.summary = summary;
  await material.save();

  res.json({ summary });
};

// POST /api/materials/:id/flashcards
const generateFlashcards = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  const count = req.body.count || 5;

  const prompt = `
Create ${count} high-yield active recall flashcards from the study material below.
Return ONLY a valid JSON array in this exact format, no extra markdown or text:
[{"question": "...", "answer": "..."}]

Study material:
${material.content}
`;

  const raw = await askGemini(prompt);
  const flashcards = safeJsonArrayParse(raw, [
    { question: "What is the core concept of this material?", answer: "Key foundational principles and architectural hierarchy." }
  ]);

  material.flashcards = flashcards;
  await material.save();

  res.json({ flashcards });
};

// POST /api/materials/:id/quiz
const generateQuiz = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  const count = req.body.count || 5;

  const prompt = `
Create ${count} multiple choice quiz questions with 4 options and the correct answer string from the study material below.
Return ONLY a valid JSON array in this exact format, no extra markdown or text:
[{"question": "...", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "Option A"}]

Study material:
${material.content}
`;

  const raw = await askGemini(prompt);
  const quiz = safeJsonArrayParse(raw, [
    {
      question: "Which of the following best summarizes the material?",
      options: ["Structured modular learning", "Random unstructured data", "Manual calculations only", "Static storage"],
      answer: "Structured modular learning"
    }
  ]);

  material.quiz = quiz;
  await material.save();

  res.json({ quiz });
};

// POST /api/materials/:id/study-plan
const generateStudyPlan = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  const { goal, hoursPerDay, days } = req.body;

  const prompt = `
You are an expert academic study planner. Based on the study material below, create a personalized ${days || 7}-day study plan.
Student Goal: ${goal || "Understand and master key concepts for exams"}
Daily Study Time: ${hoursPerDay || 2} hours per day.

Return a clear day-by-day revision schedule with actionable topics and active recall tasks.

Study material:
${material.content}
`;

  const studyPlan = await askGemini(prompt);

  material.studyPlan = studyPlan;
  await material.save();

  res.json({ studyPlan });
};

module.exports = {
  uploadMaterial,
  getMaterials,
  getMaterial,
  deleteMaterial,
  summarize,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
};
