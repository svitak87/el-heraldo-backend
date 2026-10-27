import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { dbConnection, sequelize } from "./src/config/db.js";
import Product from "./src/models/product.js";

import { datarouter } from "./src/routes/dataRoute.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/api/v1", datarouter);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await dbConnection();

    // Create the products table if it does not exist.
    await sequelize.sync();

    app.listen(PORT, () => {
      console.log(`Backend service is running on port: ${PORT} 📈`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error.message);
    process.exit(1);
  }
};

startServer();