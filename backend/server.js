// server.js PRO - completo para Railway con Excel y SSL
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const ExcelJS = require("exceljs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ----------------- Conexión MySQL con SSL -----------------
const db = mysql.createPool({
  host: "crossover.proxy.rlwy.net",
  user: "root",
  password: "olUAUFxKCdxJxcnjgUcHmccxlNjJgeHR",
  database: "railway",
  port: 38474,
  ssl: { rejectUnauthorized: false }, // <- habilita SSL
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, conn) => {
  if (err) console.error("Error conectando BD:", err);
  else {
    console.log("DB conectada ✅");
    conn.release();
  }
});

// ----------------- Función JWT -----------------
function verificarToken(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).send({ msg: "Token requerido" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).send({ msg: "Token inválido" });

  jwt.verify(token, process.env.JWT_SECRET || "clave_secreta", (err, decoded) => {
    if (err) return res.status(401).send({ msg: "Token inválido" });
    req.user = decoded;
    next();
  });
}

// ----------------- Función Euclidean Distance -----------------
function euclideanDistance(a, b) {
  if (typeof a === "string") a = JSON.parse(a);
  if (typeof b === "string") b = JSON.parse(b);

  if (!Array.isArray(a) || !Array.isArray(b)) return 999;
  if (a.length !== b.length) return 999;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = Number(a[i]) - Number(b[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// ----------------- Login Admin -----------------
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send({ msg: "Datos incompletos" });

  db.query("SELECT * FROM usuarios WHERE username=?", [username], async (err, rows) => {
    if (err) {
      console.error("Error BD login:", err);
      return res.status(500).send({ msg: "Error BD" });
    }
    if (rows.length === 0) return res.status(400).send({ msg: "Usuario no encontrado" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send({ msg: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "clave_secreta",
      { expiresIn: "12h" }
    );

    res.send({ token, role: user.role });
  });
});

// ----------------- Registrar Persona -----------------
app.post("/registrar-persona", verificarToken, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send({ msg: "No autorizado" });

  const { nombre, sede, descriptors } = req.body;
  if (!nombre || !sede || !descriptors || !Array.isArray(descriptors) || descriptors.length === 0)
    return res.status(400).send({ msg: "Datos incompletos" });

  db.query("INSERT INTO personas (nombre, sede, activo) VALUES (?, ?, 1)", [nombre, sede], (err, result) => {
    if (err) {
      console.error("Error insert persona:", err);
      return res.status(500).send({ msg: "Error guardando persona" });
    }

    const personaId = result.insertId;
    const values = descriptors.map(d => [personaId, JSON.stringify(d)]);
    db.query("INSERT INTO descriptores (persona_id, descriptor) VALUES ?", [values], err2 => {
      if (err2) {
        console.error("Error insert descriptors:", err2);
        return res.status(500).send({ msg: "Error guardando descriptores" });
      }

      res.send({ msg: "Persona registrada correctamente ✅" });
    });
  });
});

// ----------------- Reconocer y registrar asistencia -----------------
const FACE_THRESHOLD = 0.55;

app.post("/reconocer", (req, res) => {
  try {
    const { descriptor, tipo } = req.body;
    const tiposValidos = ["entrada", "salida", "descanso", "entrada_descanso"];

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0)
      return res.status(400).send({ ok: false, mensaje: "Descriptor inválido" });

    if (!tipo || !tiposValidos.includes(tipo))
      return res.status(400).send({ ok: false, mensaje: "Tipo inválido" });

    db.query("SELECT * FROM personas WHERE activo=1", (err, personas) => {
      if (err) return res.status(500).send({ ok: false, mensaje: "Error BD" });

      let personaCoincidente = null;
      let minDist = 999;

      for (const p of personas) {
        let desc = null;
        try { desc = JSON.parse(p.descriptor); } 
        catch(e){ continue; }

        const distancia = euclideanDistance(desc, descriptor);
        if (distancia < minDist) {
          minDist = distancia;
          personaCoincidente = p;
        }
      }

      if (!personaCoincidente || minDist > 0.75)
        return res.send({ ok: false, mensaje: "Rostro no reconocido" });

      const sqlHoy = `SELECT * FROM registros WHERE nombre=? AND DATE(fecha)=CURDATE()`;
      db.query(sqlHoy, [personaCoincidente.nombre], (err2, registros) => {
        if (err2) return res.status(500).send({ ok: false, mensaje: "Error BD" });

        const accionesHoy = registros.map(r => r.tipo);

        // Validación lógica
        if (tipo === "entrada" && accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "Ya registraste entrada hoy" });
        if (tipo === "salida" && !accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "No puedes salir sin haber entrado" });
        if (tipo === "salida" && accionesHoy.includes("salida"))
          return res.send({ ok: false, mensaje: "Ya registraste salida hoy" });
        if (tipo === "descanso" && !accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "No puedes tomar descanso sin entrar primero" });
        if (tipo === "descanso" && accionesHoy.includes("descanso"))
          return res.send({ ok: false, mensaje: "Ya registraste descanso hoy" });
        if (tipo === "entrada_descanso" && !accionesHoy.includes("descanso"))
          return res.send({ ok: false, mensaje: "No puedes entrar de descanso sin haber salido de descanso" });
        if (tipo === "entrada_descanso" && accionesHoy.includes("entrada_descanso"))
          return res.send({ ok: false, mensaje: "Ya registraste entrada de descanso hoy" });

        db.query(
          "INSERT INTO registros (nombre, tipo) VALUES (?, ?)",
          [personaCoincidente.nombre, tipo],
          err3 => {
            if (err3) return res.status(500).send({ ok: false, mensaje: "Error guardando registro" });

            res.send({
              ok: true,
              nombre: personaCoincidente.nombre,
              tipo,
              mensaje: `${personaCoincidente.nombre} - ${tipo} registrado ✅`
            });
          }
        );
      });
    });

  } catch(e) {
    console.error(e);
    res.status(500).send({ ok: false, mensaje: "Error interno servidor" });
  }
});

// ----------------- Panel Administrativo -----------------
app.get("/personas", verificarToken, (req, res) => {
  db.query("SELECT id, nombre, sede, activo FROM personas", (err, rows) => {
    if (err) return res.status(500).send([]);
    res.send(rows);
  });
});

app.post("/personas/:id/toggle", verificarToken, (req,res)=>{
  const id = req.params.id;
  db.query("UPDATE personas SET activo = NOT activo WHERE id=?", [id], (err)=>{
    if(err) return res.status(500).send({ ok:false, msg:"Error BD" });
    res.send({ ok:true, msg:"Estado cambiado correctamente" });
  });
});

// ----------------- Dashboard -----------------
app.get("/asistencias", verificarToken, (req, res) => {
  const { fecha, nombre } = req.query;

  let sql = "SELECT nombre, tipo, fecha FROM registros";
  const params = [];
  const conditions = [];

  if (fecha) {
    conditions.push("DATE(fecha) = ?");
    params.push(fecha);
  }

  if (nombre) {
    conditions.push("nombre LIKE ?");
    params.push(`%${nombre}%`);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY fecha DESC";

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).send([]);
    res.send(rows);
  });
});

// ----------------- Exportar registros a Excel -----------------
app.get("/exportar-registros", verificarToken, async (req, res) => {
  try {
    const { fecha, nombre } = req.query;

    let sql = "SELECT nombre, tipo, fecha FROM registros";
    const params = [];
    const conditions = [];

    if (fecha) {
      conditions.push("DATE(fecha) = ?");
      params.push(fecha);
    }

    if (nombre) {
      conditions.push("nombre LIKE ?");
      params.push(`%${nombre}%`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY fecha DESC";

    db.query(sql, params, async (err, rows) => {
      if (err) return res.status(500).send({ ok: false, msg: "Error BD" });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Registros");

      worksheet.columns = [
        { header: "Nombre", key: "nombre", width: 30 },
        { header: "Tipo", key: "tipo", width: 20 },
        { header: "Fecha y Hora", key: "fecha", width: 25 }
      ];

      rows.forEach(r => {
        worksheet.addRow({
          nombre: r.nombre,
          tipo: r.tipo,
          fecha: new Date(r.fecha)
        });
      });

      worksheet.getColumn("fecha").numFmt = "yyyy-mm-dd hh:mm:ss";

      worksheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=registros.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    });

  } catch (error) {
    console.error("Error generando Excel:", error);
    res.status(500).send({ ok: false, msg: "Error generando Excel" });
  }
});

// ----------------- Servir login -----------------
app.get("/", (req,res)=>{
  res.sendFile(path.join(__dirname,"public/login.html"));
});

// ----------------- Iniciar servidor -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log("Servidor activo en puerto " + PORT);
});
