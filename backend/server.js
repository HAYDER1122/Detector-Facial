// SERVER
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const ExcelJS = require("exceljs");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// FIX #1: CORS apunta al mismo dominio en producción
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rate limiter para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Demasiados intentos fallidos. Espera 15 minutos." }
});

// Rate limiter general para rutas sensibles
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Demasiadas peticiones. Intenta más tarde." }
});

// CONEXION MYSQL
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "-05:00"
});

db.getConnection((err, conn) => {
  if (err) {
    console.error("❌ Error conectando BD:", err.code);
  } else {
    console.log("✅ DB conectada");
    conn.release();
  }
});

const dbPromise = db.promise();


// MIDDLEWARE JWT

function verificarToken(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).send({ msg: "Token requerido" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).send({ msg: "Token inválido" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    // FIX #5: Distinguir token expirado de token inválido
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).send({ msg: "Token expirado", expired: true });
      }
      return res.status(401).send({ msg: "Token inválido" });
    }
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

// Validación de longitud de password (bcrypt solo procesa 72 chars)
function validarPassword(password, res) {
  if (!password || password.length > 72) {
    res.status(400).send({ msg: "La contraseña debe tener entre 1 y 72 caracteres" });
    return false;
  }
  return true;
}


// LOGIN

app.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).send({ msg: "Datos incompletos" });

  if (!validarPassword(password, res)) return;

  db.query("SELECT * FROM usuarios WHERE username=?", [username], async (err, rows) => {
    if (err) {
      console.error("Error en login:", err);
      return res.status(500).send({ msg: "Error BD" });
    }
    if (rows.length === 0)
      return res.status(400).send({ msg: "Usuario no encontrado" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).send({ msg: "Contraseña incorrecta" });

    if (!user.activo)
      return res.status(403).send({ msg: "Usuario desactivado. Contacta al administrador." });

    const token = jwt.sign(
      { id: user.id, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.send({ token, role: user.rol });
  });
});


// CRUD USUARIOS

app.get("/usuarios", verificarToken, soloAdmin, (req, res) => {
  db.query("SELECT id, username, rol, activo FROM usuarios", (err, rows) => {
    if (err) {
      console.error("Error obteniendo usuarios:", err);
      return res.status(500).send([]);
    }
    res.send(rows);
  });
});

app.post("/usuarios", verificarToken, soloAdmin, async (req, res) => {
  const { username, password, rol, activo } = req.body;

  if (!username || !password || !rol)
    return res.status(400).json({ msg: "Completa todos los campos" });

  if (!["admin", "user"].includes(rol))
    return res.status(400).json({ msg: "Rol inválido" });

  if (!validarPassword(password, res)) return;

  db.query("SELECT id FROM usuarios WHERE username = ?", [username], async (err, rows) => {
    if (err) {
      console.error("Error verificando usuario:", err);
      return res.status(500).json({ msg: "Error BD" });
    }
    if (rows.length > 0) return res.status(400).json({ msg: "Usuario ya existe" });

    const hash = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO usuarios (username, password, rol, activo, creado_en) VALUES (?, ?, ?, ?, NOW())",
      [username, hash, rol, activo ? 1 : 0],
      err2 => {
        if (err2) {
          console.error("Error creando usuario:", err2);
          return res.status(500).json({ msg: "Error guardando usuario" });
        }
        res.json({ msg: "Usuario creado correctamente ✅" });
      }
    );
  });
});

app.put("/usuarios/:id", verificarToken, soloAdmin, async (req, res) => {
  const { username, rol, password } = req.body;
  if (!username || !rol) return res.status(400).json({ msg: "Datos incompletos" });

  let sql = "UPDATE usuarios SET username=?, rol=? WHERE id=?";
  let params = [username, rol, req.params.id];

  if (password) {
    if (!validarPassword(password, res)) return;
    const hash = await bcrypt.hash(password, 10);
    sql = "UPDATE usuarios SET username=?, rol=?, password=? WHERE id=?";
    params = [username, rol, hash, req.params.id];
  }

  db.query(sql, params, err => {
    if (err) {
      console.error("Error actualizando usuario:", err);
      return res.status(500).json({ msg: "Error actualizando" });
    }
    res.json({ ok: true });
  });
});

app.delete("/usuarios/:id", verificarToken, soloAdmin, (req, res) => {
  // FIX #6: Evitar que un admin se elimine a sí mismo
  if (req.params.id == req.user.id)
    return res.status(400).json({ msg: "No puedes eliminar tu propia cuenta" });

  db.query("DELETE FROM usuarios WHERE id=?", [req.params.id], err => {
    if (err) {
      console.error("Error eliminando usuario:", err);
      return res.status(500).json({ ok: false });
    }
    res.json({ ok: true });
  });
});

app.post("/usuarios/:id/toggle", verificarToken, soloAdmin, (req, res) => {
  // FIX #6: Evitar que un admin se desactive a sí mismo
  if (req.params.id == req.user.id)
    return res.status(400).json({ msg: "No puedes desactivarte a ti mismo" });

  db.query("UPDATE usuarios SET activo = NOT activo WHERE id=?", [req.params.id], err => {
    if (err) {
      console.error("Error en toggle usuario:", err);
      return res.status(500).json({ ok: false });
    }
    res.json({ ok: true });
  });
});


// REGISTRAR PERSONA

app.post("/registrar-persona",  (req, res) => {
  const { nombre, sede, descriptors } = req.body;

  if (!nombre || !sede || !Array.isArray(descriptors))
    return res.status(400).send({ msg: "Datos incompletos" });

  const nuevoDescriptor = descriptors[0];

  db.query("SELECT descriptor FROM descriptores", (err, rows) => {
    if (err) {
      console.error("Error obteniendo descriptores:", err);
      return res.status(500).send({ msg: "Error BD" });
    }

    for (const row of rows) {
      const dist = euclideanDistance(row.descriptor, nuevoDescriptor);
      if (dist < 0.6)
        return res.status(400).send({ msg: "Rostro ya registrado" });
    }

    db.query(
      "INSERT INTO personas (nombre, sede, activo) VALUES (?, ?, 1)",
      [nombre, sede],
      (err2, result) => {
        if (err2) {
          console.error("Error guardando persona:", err2);
          return res.status(500).send({ msg: "Error guardando persona" });
        }

        const personaId = result.insertId;
        const values = descriptors.map(d => [personaId, JSON.stringify(d)]);

        db.query(
          "INSERT INTO descriptores (persona_id, descriptor) VALUES ?",
          [values],
          err3 => {
            if (err3) {
              console.error("Error guardando descriptores:", err3);
              return res.status(500).send({ msg: "Error guardando descriptores" });
            }
            res.send({ msg: "Persona registrada correctamente ✅" });
          }
        );
      }
    );
  });
});


// RECONOCER
// FIX #2: Lógica de descanso corregida — todo normalizado a tipos de BD

app.post("/reconocer", generalLimiter,  (req, res) => {
  console.time("Reconocer");

  const { descriptor, tipo } = req.body;
  const tiposValidos = ["entrada", "salida", "descanso", "entrada_descanso"];

  if (!descriptor || !Array.isArray(descriptor))
    return res.status(400).send({ ok: false });

  if (!tiposValidos.includes(tipo))
    return res.status(400).send({ ok: false });

  // FIX #2: Mapeo al inicio para usar en validaciones consistentemente
  const tipoDBMap = {
    entrada: "entrada",
    salida: "salida",
    descanso: "descanso_salida",
    entrada_descanso: "descanso_entrada"
  };
  const tipoGuardado = tipoDBMap[tipo];

  db.query(`
    SELECT p.id, p.nombre, d.descriptor
    FROM personas p
    JOIN descriptores d ON d.persona_id = p.id
    WHERE p.activo = 1
  `, (err, filas) => {

    if (err) {
      console.error("Error en reconocer:", err);
      return res.status(500).send({ ok: false });
    }

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
        if (err2) {
          console.error("Error obteniendo registros del día:", err2);
          return res.status(500).send({ ok: false });
        }

        // FIX #2: accionesHoy usa tipos de BD (descanso_salida, descanso_entrada)
        const accionesHoy = registros.map(r => r.tipo);

        if (tipoGuardado === "entrada" && accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "Ya registraste entrada hoy" });

        if (tipoGuardado === "salida" && !accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "No puedes salir sin entrar" });

        if (tipoGuardado === "salida" && accionesHoy.includes("salida"))
          return res.send({ ok: false, mensaje: "Ya registraste salida hoy" });

        if (tipoGuardado === "descanso_salida" && !accionesHoy.includes("entrada"))
          return res.send({ ok: false, mensaje: "No puedes descansar sin entrar" });

        if (tipoGuardado === "descanso_salida" && accionesHoy.includes("descanso_salida"))
          return res.send({ ok: false, mensaje: "Ya registraste salida a descanso hoy" });

        if (tipoGuardado === "descanso_entrada" && !accionesHoy.includes("descanso_salida"))
          return res.send({ ok: false, mensaje: "No puedes entrar de descanso sin salir antes" });

        if (tipoGuardado === "descanso_entrada" && accionesHoy.includes("descanso_entrada"))
          return res.send({ ok: false, mensaje: "Ya registraste entrada de descanso hoy" });

        db.query(
          "INSERT INTO registros (persona_id, tipo, fecha_hora) VALUES (?, ?, NOW())",
          [personaCoincidente.id, tipoGuardado],
          err3 => {
            console.timeEnd("Reconocer");
            if (err3) {
              console.error("Error guardando registro:", err3);
              return res.status(500).send({ ok: false });
            }
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
    if (err) {
      console.error("Error obteniendo personas:", err);
      return res.status(500).send([]);
    }
    res.send(rows);
  });
});

app.post("/personas/:id/toggle", verificarToken, soloAdmin, (req, res) => {
  db.query("UPDATE personas SET activo = NOT activo WHERE id=?", [req.params.id], err => {
    if (err) {
      console.error("Error en toggle persona:", err);
      return res.status(500).send({ ok: false });
    }
    res.send({ ok: true });
  });
});

app.put("/personas/:id", verificarToken, soloAdmin, (req, res) => {
  const { nombre, sede } = req.body;
  db.query(
    "UPDATE personas SET nombre=?, sede=? WHERE id=?",
    [nombre, sede, req.params.id],
    err => {
      if (err) {
        console.error("Error actualizando persona:", err);
        return res.status(500).send({ ok: false });
      }
      res.send({ ok: true });
    }
  );
});

app.delete("/personas/:id", verificarToken, soloAdmin, (req, res) => {
  db.query("DELETE FROM personas WHERE id=?", [req.params.id], err => {
    if (err) {
      console.error("Error eliminando persona:", err);
      return res.status(500).send({ ok: false });
    }
    res.send({ ok: true });
  });
});


// ASISTENCIAS
// FIX #4: Paginación agregada para evitar limite fijo de 500

app.get("/asistencias", verificarToken, soloAdmin, (req, res) => {
  const { desde, hasta, busqueda, tipo, page } = req.query;
  const limit = 50;
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

  let sql = `
    SELECT r.id, p.nombre, p.sede, r.tipo, r.fecha_hora AS fecha
    FROM registros r
    JOIN personas p ON r.persona_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (desde) { sql += " AND DATE(r.fecha_hora) >= ?"; params.push(desde); }
  if (hasta) { sql += " AND DATE(r.fecha_hora) <= ?"; params.push(hasta); }
  if (busqueda) {
    sql += " AND (LOWER(p.nombre) LIKE ? OR LOWER(p.sede) LIKE ?)";
    params.push(`%${busqueda.toLowerCase()}%`, `%${busqueda.toLowerCase()}%`);
  }
  if (tipo) { sql += " AND r.tipo = ?"; params.push(tipo); }

  sql += ` ORDER BY r.fecha_hora DESC LIMIT ${limit} OFFSET ${offset}`;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Error obteniendo registros:", err);
      return res.status(500).json([]);
    }
    res.json({ data: rows, page: parseInt(page) || 1, limit });
  });
});


// EXPORTAR EXCEL

app.get("/exportar-registros", verificarToken, soloAdminOOperador, async (req, res) => {
  const { desde, hasta, busqueda, tipo } = req.query;

  let sql = `
    SELECT r.id, p.nombre, p.sede, r.tipo, r.fecha_hora AS fecha
    FROM registros r
    JOIN personas p ON r.persona_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (desde) { sql += " AND DATE(r.fecha_hora) >= ?"; params.push(desde); }
  if (hasta) { sql += " AND DATE(r.fecha_hora) <= ?"; params.push(hasta); }
  if (busqueda) {
    sql += " AND (LOWER(p.nombre) LIKE ? OR LOWER(p.sede) LIKE ?)";
    params.push(`%${busqueda.toLowerCase()}%`, `%${busqueda.toLowerCase()}%`);
  }
  if (tipo) { sql += " AND r.tipo = ?"; params.push(tipo); }

  sql += " ORDER BY r.fecha_hora DESC";

  db.query(sql, params, async (err, rows) => {
    if (err) {
      console.error("Error generando Excel:", err);
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

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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