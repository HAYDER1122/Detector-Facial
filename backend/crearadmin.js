const mysql = require("mysql2");
const bcrypt = require("bcrypt");

// ---------------- CONFIGURACIÓN ----------------
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "asistencia"
});

const username = "admin";        // Usuario que quieres
const plainPassword = "123456";  // Contraseña
const role = "admin";             // Rol

const saltRounds = 10;

// ---------------- CONEXIÓN ----------------
db.connect(err => {
  if (err) throw err;
  console.log("DB conectada 😎");

  // ---------------- GENERAR HASH ----------------
  bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
    if (err) throw err;

    // ---------------- INSERTAR USUARIO ----------------
    const sql = "INSERT INTO usuarios (username, password, role) VALUES (?, ?, ?)";
    db.query(sql, [username, hash, role], (err2, result) => {
      if (err2) {
        if (err2.code === "ER_DUP_ENTRY") {
          console.log("El usuario ya existe ✅");
        } else {
          console.error("Error al crear usuario:", err2);
        }
      } else {
        console.log("Usuario admin creado correctamente ✅");
      }
      db.end();
    });
  });
});
