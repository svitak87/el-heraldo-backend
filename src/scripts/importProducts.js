import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

import { dbConnection, sequelize } from "../config/db.js";
import Product from "../models/product.js";

const FILE_PATH = new URL("../../data/products2026.csv", import.meta.url);

const parsePrice = (value) => {
  const normalizedValue = value
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!normalizedValue || normalizedValue === "-") {
    return null;
  }

  const numberValue = Number(
    normalizedValue.replace(/\./g, "").replace(",", "."),
  );

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`Invalid price: ${value}`);
  }

  return numberValue.toFixed(2);
};

const importProducts = async () => {
  try {
    await dbConnection();

    const fileContent = await readFile(FILE_PATH, "utf8");

    const records = parse(fileContent, {
      bom: true,
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });

    const requiredColumns = [
      "SKU",
      "PRODUCTO",
      "PRECIO UNIT",
      "PRECIO IVA",
      "CATEGORIA",
      "SUB CATEGORIA",
    ];

    const actualColumns = Object.keys(records[0] ?? {});

    const missingColumns = requiredColumns.filter(
      (column) => !actualColumns.includes(column),
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Missing CSV columns: ${missingColumns.join(", ")}`,
      );
    }

    const seenSkus = new Set();

    const products = records.map((record, index) => {
      const rowNumber = index + 2;
      const sku = record.SKU.trim();
      const name = record.PRODUCTO.trim();
      const category = record.CATEGORIA.trim();
      const subCategory = record.SUB_CATEGORIA.trim();

      if (!sku || !name || !category) {
        throw new Error(
          `Row ${rowNumber}: SKU, product name, subCategory and category are required`,
        );
      }

      if (seenSkus.has(sku)) {
        throw new Error(`Row ${rowNumber}: duplicate SKU ${sku}`);
      }

      seenSkus.add(sku);

      let onRequest = null;

      if (["SI", "SÍ", "TRUE", "1"].includes(requestValue)) {
        onRequest = true;
      } else if (["NO", "FALSE", "0"].includes(requestValue)) {
        onRequest = false;
      }

      return {
        sku,
        name,
        unitPrice: parsePrice(record["PRECIO UNIT"]),
        priceWithTax: parsePrice(record["PRECIO IVA"]),
        category,
        subCategory,
        onRequest,
        isActive: true,
        lastSeenAt: null,
      };
    });

    // Validate the complete file before writing any records.
    await sequelize.transaction(async (transaction) => {
      await Product.bulkCreate(products, {
        transaction,
        validate: true,
      });
    });

    console.log(`Successfully imported ${products.length} products.`);
  } catch (error) {
    console.error("Product import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

importProducts();
