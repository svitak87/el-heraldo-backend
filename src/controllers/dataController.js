import Product from "../models/product.js";
import { Op } from "sequelize";

//obtener los productos paginados por categoría
export const getData = async (req, res) => {
  try {
    const { category } = req.params;

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );

    const offset = (page - 1) * limit;

    const { count, rows } = await Product.findAndCountAll({
      where: {
        category,
        isActive: true,
      },
      attributes: [
        "sku",
        "name",
        "unitPrice",
        "priceWithTax",
        "category",
        "onRequest",
      ],
      order: [["name", "ASC"]],
      limit,
      offset,
    });

    return res.status(200).json({
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);

    return res.status(500).json({
      message: "No se pudieron obtener los productos.",
    });
  }
};

//obtener las categorías
export const getCategories = async (req, res) => {
  try {
    const categories = await Product.findAll({
      attributes: ["category"],
      where: {
        isActive: true,
      },
      group: ["category"],
      order: [["category", "ASC"]],
    });

    return res.status(200).json({
      data: categories.map((item) => {
        const category = item.category.toLowerCase();
        const id = category
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        return {
          id,
          name: category.charAt(0).toUpperCase() + category.slice(1),
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching categories:", error.message);

    return res.status(500).json({
      message: "No se pudieron obtener las categorías.",
    });
  }
};

//obtener un producto por su nombre o plabara clave
export const searchProducts = async (req, res) => {
  try {
    const keyword = req.query.keyword?.trim();

    if (!keyword) {
      return res.status(400).json({
        message: "Debés ingresar una palabra clave para buscar.",
      });
    }

    if (keyword.length > 100) {
      return res.status(400).json({
        message: "La búsqueda no puede superar los 100 caracteres.",
      });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );

    const offset = (page - 1) * limit;

    const { count, rows } = await Product.findAndCountAll({
      where: {
        isActive: true,
        [Op.or]: [
          { name: { [Op.like]: `%${keyword}%` } },
          { category: { [Op.like]: `%${keyword}%` } },
        ],
      },
      attributes: [
        "sku",
        "name",
        "unitPrice",
        "priceWithTax",
        "category",
        "onRequest",
      ],
      order: [["name", "ASC"]],
      limit,
      offset,
    });

    return res.status(200).json({
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error searching products:", error.message);

    return res.status(500).json({
      message: "No se pudieron buscar los productos.",
    });
  }
};
