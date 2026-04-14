const bcrypt = require("bcrypt");

// ---------------- DATOS ----------------
const username = "admin";
const plainPassword = "123456";
const rol = "admin";

const saltRounds = 10;

// ---------------- GENERAR HASH ----------------
bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
  if (err) {
    console.error("❌ Error al generar hash:", err);
    return;
  }

  console.log("=================================");
  console.log("👤 Usuario:", username);
  console.log("🔐 Password plano:", plainPassword);
  console.log("🔒 Password en hash:");
  console.log(hash);
  console.log("🎭 Rol:", rol);
  console.log("=================================");
});