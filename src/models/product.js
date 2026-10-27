import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Product = sequelize.define(
  "Product",
  {
    sku: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "nombre",
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: "precio_unitario",
      validate: { min: 0 },
    },
    priceWithTax: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: "precio_iva",
      validate: { min: 0 },
    },
    category: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "categoria",
    },
    subCategory: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "sub_category",
    },
    onRequest: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      field: "a_pedido",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_seen_at",
    },
  },
  {
    tableName: "products",
    timestamps: false,
    indexes: [
      {
        name: "idx_products_category_name",
        fields: ["categoria", "nombre"],
      },
    ],
  },
);

export default Product;
