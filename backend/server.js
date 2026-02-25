// SERVER 
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

// CONEXION MYSQL

const db = mysql.createPool({
  host: process.env.DB_HOST || "crossover.proxy.rlwy.net",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "olUAUFxKCdxJxcnjgUcHmccxlNjJgeHR",
  database: process.env.DB_NAME || "railway",
  port: Number(process.env.DB_PORT) || 38474,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, conn) => {
  if (err) {
    console.error("❌ Error conectando BD:", err.code);
  } else {
    console.log("✅ DB conectada");
    conn.release();
  }
});

module.exports = db.promise();


// MIDDLEWARE JWT

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

function soloAdmin(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).send({ msg: "Acceso solo admin" });
  next();
}

function soloAdminOOperador(req, res, next) {
  if (!["admin", "user"].includes(req.user.role))
    return res.status(403).send({ msg: "No autorizado" });
  next();
}


// FUNCION DISTANCIA EUCLIDEANA

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

const FACE_THRESHOLD = 0.45;


// LOGIN


app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).send({ msg: "Datos incompletos" });

  db.query("SELECT * FROM usuarios WHERE username=?", [username], async (err, rows) => {
    if (err) return res.status(500).send({ msg: "Error BD" });
    if (rows.length === 0)
      return res.status(400).send({ msg: "Usuario no encontrado" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).send({ msg: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: user.id, role: user.rol },
      process.env.JWT_SECRET || "clave_secreta",
      { expiresIn: "12h" }
    );

    res.send({ token, role: user.rol });
  });
});


// CREAR USUARIO


app.post("/crear-usuario", verificarToken, soloAdmin, async (req, res) => {
  const { username, password, rol } = req.body;

  if (!username || !password || !rol)
    return res.status(400).send({ msg: "Datos incompletos" });

  if (!["admin", "operador", "visor"].includes(rol))
    return res.status(400).send({ msg: "Rol inválido" });

  db.query("SELECT id FROM usuarios WHERE username=?", [username], async (err, rows) => {
    if (rows.length > 0)
      return res.status(400).send({ msg: "Usuario ya existe" });

    const hashed = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)",
      [username, hashed, rol],
      err2 => {
        if (err2) return res.status(500).send({ msg: "Error creando usuario" });
        res.send({ ok: true, msg: "Usuario creado correctamente ✅" });
      }
    );
  });
});

app.get("/usuarios", verificarToken, soloAdmin, (req, res) => {
  db.query("SELECT id, username, rol FROM usuarios", (err, rows) => {
    if (err) return res.status(500).send([]);
    res.send(rows);
  });
});


// REGISTRAR PERSONA


app.post("/registrar-persona", verificarToken, soloAdmin, (req, res) => {
  const { nombre, sede, descriptors } = req.body;

  if (!nombre || !sede || !Array.isArray(descriptors))
    return res.status(400).send({ msg: "Datos incompletos" });

  const nuevoDescriptor = descriptors[0];

  db.query("SELECT descriptor FROM descriptores", (err, rows) => {
    if (err) return res.status(500).send({ msg: "Error BD" });

    for (const row of rows) {
      const dist = euclideanDistance(row.descriptor, nuevoDescriptor);
      if (dist < 0.6)
        return res.status(400).send({ msg: "Rostro ya registrado" });
    }

    db.query(
      "INSERT INTO personas (nombre, sede, activo) VALUES (?, ?, 1)",
      [nombre, sede],
      (err2, result) => {
        if (err2) return res.status(500).send({ msg: "Error guardando persona" });

        const personaId = result.insertId;
        const values = descriptors.map(d => [personaId, JSON.stringify(d)]);

        db.query(
          "INSERT INTO descriptores (persona_id, descriptor) VALUES ?",
          [values],
          err3 => {
            if (err3)
              return res.status(500).send({ msg: "Error guardando descriptores" });

            res.send({ msg: "Persona registrada correctamente ✅" });
          }
        );
      }
    );
  });
});


// RECONOCER 


app.post("/reconocer", (req, res) => {
  console.time("Reconocer");

  const { descriptor, tipo } = req.body;
  const tiposValidos = ["entrada", "salida", "descanso", "entrada_descanso"];

  if (!descriptor || !Array.isArray(descriptor))
    return res.status(400).send({ ok: false });

  if (!tiposValidos.includes(tipo))
    return res.status(400).send({ ok: false });

  db.query(`
    SELECT p.id, p.nombre, d.descriptor
    FROM personas p
    JOIN descriptores d ON d.persona_id = p.id
    WHERE p.activo = 1
    LIMIT 100
  `, (err, filas) => {

    if (err) return res.status(500).send({ ok: false });

    let personaCoincidente = null;
    let minDist = 999;

    filas.forEach(f => {
      const dist = euclideanDistance(f.descriptor, descriptor);
      if (dist < minDist) {
        minDist = dist;
        personaCoincidente = f;
      }
    });

    if (!personaCoincidente || minDist > FACE_THRESHOLD)
      return res.send({ ok: false, mensaje: "Rostro no reconocido" });

    db.query(
      `SELECT tipo FROM registros WHERE persona_id=? AND DATE(fecha_hora)=CURDATE()`,
      [personaCoincidente.id],
      (err2, registros) => {

        const accionesHoy = registros.map(r => r.tipo);

        if (tipo === "entrada" && accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "Ya registraste entrada hoy" });

        if (tipo === "salida" && !accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "No puedes salir sin entrar" });

        if (tipo === "salida" && accionesHoy.includes("salida"))
          return res.send({ ok: false, mensaje: "Ya registraste salida hoy" });

        if (tipo === "descanso" && !accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "No puedes descansar sin entrar" });

        if (tipo === "descanso" && accionesHoy.includes("descanso_salida"))
          return res.send({ ok: false, mensaje: "Ya registraste descanso hoy" });

        if (tipo === "entrada_descanso" && !accionesHoy.includes("descanso_salida"))
          return res.send({ ok: false, mensaje: "No puedes entrar de descanso sin salir antes" });

        if (tipo === "entrada_descanso" && accionesHoy.includes("descanso_entrada"))
          return res.send({ ok: false, mensaje: "Ya registraste entrada de descanso hoy" });

        const tipoDBMap = {
          entrada: "entrada",
          salida: "salida",
          descanso: "descanso_salida",
          entrada_descanso: "descanso_entrada"
        };

        db.query(
          "INSERT INTO registros (persona_id, tipo, fecha_hora) VALUES (?, ?, NOW())",
          [personaCoincidente.id, tipoDBMap[tipo]],
          err3 => {
            console.timeEnd("Reconocer");
            if (err3) return res.status(500).send({ ok: false });

            res.send({
              ok: true,
              nombre: personaCoincidente.nombre,
              mensaje: `${personaCoincidente.nombre} - ${tipo} registrado ✅`
            });
          }
        );
      }
    );
  });
});


// PERSONAS


app.get("/personas", verificarToken, (req, res) => {
  db.query("SELECT id, nombre, sede, activo FROM personas", (err, rows) => {
    if (err) return res.status(500).send([]);
    res.send(rows);
  });
});

app.post("/personas/:id/toggle", verificarToken, soloAdmin, (req, res) => {
  db.query("UPDATE personas SET activo = NOT activo WHERE id=?", [req.params.id], err => {
    if (err) return res.status(500).send({ ok: false });
    res.send({ ok: true });
  });
});

app.put("/personas/:id", verificarToken, soloAdmin, (req, res) => {
  const { nombre, sede } = req.body;
  db.query(
    "UPDATE personas SET nombre=?, sede=? WHERE id=?",
    [nombre, sede, req.params.id],
    err => {
      if (err) return res.status(500).send({ ok: false });
      res.send({ ok: true });
    }
  );
});

app.delete("/personas/:id", verificarToken, soloAdmin, (req, res) => {
  db.query("DELETE FROM descriptores WHERE persona_id=?", [req.params.id], () => {
    db.query("DELETE FROM personas WHERE id=?", [req.params.id], err => {
      if (err) return res.status(500).send({ ok: false });
      res.send({ ok: true });
    });
  });
});
// Crear usuario
app.post("/usuarios", verificarToken, soloAdmin, async (req, res) => {
  const { username, password, rol, activo } = req.body;

  if (!username || !password || !rol) {
    return res.status(400).json({ msg: "Completa todos los campos" });
  }

  if (!["admin","user"].includes(rol)) {
    return res.status(400).json({ msg: "Rol inválido" });
  }

  try {
    // Usamos el pool que ya definiste
    db.query(
      "SELECT * FROM usuarios WHERE username = ?",
      [username],
      async (err, rows) => {
        if (err) return res.status(500).json({ msg: "Error BD" });
        if (rows.length > 0) return res.status(400).json({ msg: "Usuario ya existe" });

        const hash = await bcrypt.hash(password, 10);

        db.query(
          "INSERT INTO usuarios (username, password, rol, activo, creado_en) VALUES (?, ?, ?, ?, NOW())",
          [username, hash, rol, activo ? 1 : 0],
          err2 => {
            if (err2) return res.status(500).json({ msg: "Error guardando usuario" });
            res.json({ msg: "Usuario creado correctamente ✅" });
          }
        );
      }
    );

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

// ----------------- ASISTENCIAS -----------------
app.get("/asistencias", verificarToken, soloAdminOOperador, (req, res) => {
  const { fecha, busqueda } = req.query;

  let sql = `
    SELECT r.id, p.nombre, p.sede, r.tipo, r.fecha_hora AS fecha
    FROM registros r
    JOIN personas p ON r.persona_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (fecha) {
    sql += " AND DATE(r.fecha_hora) = ?";
    params.push(fecha);
  }

  if (busqueda) {
    sql += " AND (LOWER(p.nombre) LIKE ? OR LOWER(p.sede) LIKE ?)";
    params.push(`%${busqueda.toLowerCase()}%`, `%${busqueda.toLowerCase()}%`);
  }

  sql += " ORDER BY r.fecha_hora DESC LIMIT 500";

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Error obteniendo registros:", err);
      return res.status(500).json([]);
    }
    res.json(rows);
  });
});

// ----------------- EXPORTAR EXCEL -----------------
app.get("/exportar-registros", verificarToken, soloAdminOOperador, async (req, res) => {
  const { fecha, busqueda } = req.query;

  let sql = `
    SELECT r.id, p.nombre, p.sede, r.tipo, r.fecha_hora AS fecha
    FROM registros r
    JOIN personas p ON r.persona_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (fecha) {
    sql += " AND DATE(r.fecha_hora) = ?";
    params.push(fecha);
  }

  if (busqueda) {
    sql += " AND (LOWER(p.nombre) LIKE ? OR LOWER(p.sede) LIKE ?)";
    params.push(`%${busqueda.toLowerCase()}%`, `%${busqueda.toLowerCase()}%`);
  }

  sql += " ORDER BY r.fecha_hora DESC";

  db.query(sql, params, async (err, rows) => {
    if (err) {
      console.error("Error exportando registros:", err);
      return res.status(500).json({ msg: "Error generando Excel" });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Registros");

    sheet.columns = [
      { header: "Nombre", key: "nombre", width: 30 },
      { header: "Sede", key: "sede", width: 20 },
      { header: "Tipo", key: "tipo", width: 20 },
      { header: "Fecha/Hora", key: "fecha", width: 25 }
    ];

    rows.forEach(r => sheet.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=registros.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  });
});



// SERVIDOR


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Servidor activo en puerto " + PORT);
});