import express from "express";
import {
  getCategories,
  getData,
  searchProducts
} from "../controllers/dataController.js";

export const datarouter = express.Router();

datarouter.get("/categories", getCategories);
datarouter.get("/products/search", searchProducts);
datarouter.get("/products/:category", getData);