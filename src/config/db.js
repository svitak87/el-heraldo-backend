import "dotenv/config";
import { readFileSync } from "node:fs";
import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    dialect: "mysql",
    logging: false,
    dialectOptions: {
      ssl: {
        ca: readFileSync("C:/Users/Usuario/Desktop/ca.pem", "utf8"),
        rejectUnauthorized: true,
      },
    },
  },
);

export const dbConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error.message);
    throw error;
  }
};