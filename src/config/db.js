
import "dotenv/config";
import { Sequelize } from "sequelize";

const sslOptions = process.env.DB_SSL_CA
  ? {
      ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n"),
      rejectUnauthorized: true,
    }
  : undefined;

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    dialect: "mysql",
    logging: false,
    ...(sslOptions && {
      dialectOptions: {
        ssl: sslOptions,
      },
    }),
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
