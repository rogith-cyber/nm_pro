const mongoose = require("mongoose");
const dotenv = require("dotenv");
const dns = require("dns");

dotenv.config();
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connectDB = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing from backend/.env");
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
};

module.exports = connectDB;
