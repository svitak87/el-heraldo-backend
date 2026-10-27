
import "dotenv/config";


import { readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from "node:url";

import { sequelize } from "../config/db.js";
import Product from "../models/product.js";

const CSV_PATH = fileURLToPath(
  new URL("../../../data/products2026.csv", import.meta.url),
);

const REVIEW_PATH = fileURLToPath(
  new URL(`../../../data/products-review-${new Date().toISOString().slice(0, 10)}.csv`, import.meta.url),
);

const REQUIRED_COLUMNS = [
  "SKU",
  "PRODUCTO",
  "PRECIO UNIT",
  "PRECIO IVA",
  "CATEGORIA",
  "SUB CATEGORIA"
];

// Protección: cancelar si el catálogo cae por debajo del 70 %
// de los productos activos actuales. Ajustar el umbral si hace falta.
const MIN_CATALOG_RATIO = 0.7;

const parsePrice = (value) => {
  const text = String(value ?? "").trim();

  if (!text || text === "$ -" || text === "-") {
    return null;
  }

  const normalized = text
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Precio inválido: "${value}"`);
  }

  const price = Number(normalized);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Precio inválido: "${value}"`);
  }

  return price;
}

const parseOnRequest = (value) => {
  const text = String(value ?? "").trim().toLowerCase();

  if (!text || text === "a pedido") return null;

  if (["si", "sí", "true", "1"].includes(text)) return true;
  if (["no", "false", "0"].includes(text)) return false;

  throw new Error(`Valor A PEDIDO inválido: "${value}"`);
}

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

const main = async () => {
  let transaction;

  try {
    // 1. Leer y validar el archivo completo antes de modificar la DB.
    const csvContent = await readFile(CSV_PATH, "utf8");

    const rows = parse(csvContent, {
      bom: true,
      columns: true,
      delimiter: ";",
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });

    if (rows.length === 0) {
      throw new Error("El CSV está vacío. No se modificó la base de datos.");
    }

    const columns = Object.keys(rows[0]);

    const missingColumns = REQUIRED_COLUMNS.filter(
      (column) => !columns.includes(column),
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Faltan columnas obligatorias: ${missingColumns.join(", ")}`,
      );
    }

    const csvProducts = [];
    const seenSkus = new Set();

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const line = index + 2;

      const sku = String(row["SKU"] ?? "").trim();
      const name = String(row["PRODUCTO"] ?? "").trim();
      const category = String(row["CATEGORIA"] ?? "").trim();
      const subCategory = String(row["SUB CATEGORIA"] ?? "").trim();

      if (!sku || !name || !category || !subCategory) {
        throw new Error(
          `Fila ${line}: SKU, PRODUCTO, CATEGORIA y SUB CATEGORIA son obligatorios.`,
        );
      }

      if (seenSkus.has(sku)) {
        throw new Error(`SKU duplicado "${sku}" en la fila ${line}.`);
      }

      seenSkus.add(sku);

      csvProducts.push({
        sku,
        name,
        category,
        subCategory,
        unitPrice: parsePrice(row["PRECIO UNIT"]),
        priceWithTax: parsePrice(row["PRECIO IVA"]),
        line,
      });
    }

    // 2. Leer el estado actual de MySQL.
    const existingProducts = await Product.findAll();
    const existingBySku = new Map(
      existingProducts.map((product) => [String(product.sku), product]),
    );

    const activeProducts = existingProducts.filter(
      (product) => product.isActive,
    );

    const minimumAllowed = Math.ceil(
      activeProducts.length * MIN_CATALOG_RATIO,
    );

    if (csvProducts.length < minimumAllowed) {
      throw new Error(
        `Catálogo sospechosamente pequeño: ${csvProducts.length} filas. ` +
          `Se requieren al menos ${minimumAllowed} para continuar. ` +
          "No se modificó la base de datos.",
      );
    }

    // 3. Preparar el informe de precios faltantes.
    const reviewRows = [];
    const timestamp = new Date();

    for (const item of csvProducts) {
      const existing = existingBySku.get(item.sku);

      for (const field of ["unitPrice", "priceWithTax"]) {
        if (item[field] === null) {
          reviewRows.push({
            sku: item.sku,
            name: item.name,
            field,
            csvValue: "$ - o vacío",
            previousValue: existing?.[field] ?? "",
            action:
              existing?.[field] != null
                ? "Se conserva el precio anterior"
                : "Sin precio disponible; requiere revisión",
            csvLine: item.line,
          });
        }
      }
    }

    // 4. Aplicar todos los cambios dentro de una transacción.
    transaction = await sequelize.transaction();

    let inserted = 0;
    let updated = 0;
    let reactivated = 0;

    for (const item of csvProducts) {
      const existing = existingBySku.get(item.sku);

      const values = {
        name: item.name,
        category: item.category,
        subCategory: item.subCategory,
        unitPrice:
          item.unitPrice === null
            ? existing?.unitPrice ?? null
            : item.unitPrice,
        priceWithTax:
          item.priceWithTax === null
            ? existing?.priceWithTax ?? null
            : item.priceWithTax,
        onRequest: existing?.onRequest ?? false,
        isActive: true,
        lastSeenAt: timestamp,
      };

      if (!existing) {
        await Product.create(
          {
            sku: item.sku,
            ...values,
          },
          { transaction },
        );

        inserted++;
        continue;
      }

      if (!existing.isActive) {
        reactivated++;
      }

      await existing.update(values, { transaction });
      updated++;
    }

    // 5. Desactivar los SKU ausentes del CSV validado.
    const csvSkus = new Set(csvProducts.map((item) => item.sku));

    let deactivated = 0;

    for (const product of existingProducts) {
      if (product.isActive && !csvSkus.has(String(product.sku))) {
        await product.update(
          { isActive: false },
          { transaction },
        );

        deactivated++;
      }
    }

    // 6. Confirmar cambios en MySQL.
    await transaction.commit();
    transaction = null;

    // 7. Guardar el informe de revisión fuera de la transacción.
    const reviewHeader = [
      "SKU",
      "PRODUCTO",
      "CAMPO",
      "VALOR_CSV",
      "PRECIO_ANTERIOR",
      "ACCION",
      "FILA_CSV",
    ];

    const reviewContent = [
      reviewHeader,
      ...reviewRows.map((item) => [
        item.sku,
        item.name,
        item.field,
        item.csvValue,
        item.previousValue,
        item.action,
        item.csvLine,
      ]),
    ]
      .map((row) => row.map(escapeCsv).join(";"))
      .join("\n");

    await writeFile(
      REVIEW_PATH,
      "\uFEFF" + reviewContent,
      "utf8",
    );

    console.log("\nSincronización completada.");
    console.log(`Productos en CSV: ${csvProducts.length}`);
    console.log(`Nuevos: ${inserted}`);
    console.log(`Actualizados: ${updated}`);
    console.log(`Reactivados: ${reactivated}`);
    console.log(`Desactivados: ${deactivated}`);
    console.log(`Precios para revisar: ${reviewRows.length}`);
    console.log(`Informe: ${REVIEW_PATH}`);
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error("\nSincronización cancelada:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
