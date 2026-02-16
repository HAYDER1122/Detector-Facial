// ----------------- Obtener token -----------------
const token = localStorage.getItem("token"); // Token solo necesario para panel/admin
// Si no hay token, bloqueamos panel/admin
if(!token) location.href = "/login.html";

// ----------------- Cargar personas -----------------
async function cargarPersonas() {
  try {
    const res = await fetch("/personas", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const personas = await res.json();
    const tbody = document.getElementById("personasBody");
    tbody.innerHTML = "";

    personas.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.nombre}</td>
        <td>${p.sede}</td>
        <td>${p.activo ? "Sí" : "No"}</td>
        <td><button class="btn btn-sm btn-primary toggleBtn">Toggle</button></td>
      `;
      tr.querySelector(".toggleBtn").addEventListener("click", async () => {
        await fetch(`/personas/${p.id}/toggle`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
        cargarPersonas();
      });
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Error cargando personas:", err);
  }
}

// ----------------- Cargar registros -----------------
async function cargarRegistros() {
  try {
    const fecha = document.getElementById("fechaFiltro").value;
    const nombre = document.getElementById("busquedaNombre").value.trim();

    // Construimos query params dinámicos
    const params = new URLSearchParams();
    if(fecha) params.append("fecha", fecha);
    if(nombre) params.append("nombre", nombre);

    const res = await fetch("/asistencias?" + params.toString(), {
      headers: { "Authorization": `Bearer ${token}` }
    });
    let registros = await res.json();

    const tbody = document.getElementById("registrosBody");
    tbody.innerHTML = "";

    registros.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.nombre}</td><td>${r.tipo}</td><td>${new Date(r.fecha).toLocaleString()}</td>`;
      tbody.appendChild(tr);
    });

    actualizarGrafico(registros);

  } catch(err) {
    console.error("Error cargando registros:", err);
  }
}

// ----------------- Gráfico entradas/salidas -----------------
let chart;
function actualizarGrafico(data) {
  const ctx = document.getElementById("graficoAsistencias");
  const tipos = ["entrada","salida","descanso","entrada_descanso"];
  const counts = tipos.map(t => data.filter(r => r.tipo===t).length);

  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: tipos,
      datasets: [{
        label: "Cantidad",
        data: counts,
        backgroundColor: ["#0d6efd","#dc3545","#ffc107","#198754"]
      }]
    },
    options: { responsive:true, plugins:{ legend:{ display:false } } }
  });
}

// ----------------- Exportar registros a Excel -----------------
document.getElementById("exportExcel").addEventListener("click", async () => {
  const fecha = document.getElementById("fechaFiltro").value;
  const nombre = document.getElementById("busquedaNombre").value.trim();

  const params = new URLSearchParams();
  if(fecha) params.append("fecha", fecha);
  if(nombre) params.append("nombre", nombre); // <-- filtrará solo por nombre si fecha vacía

  try {
    const res = await fetch("/exportar-registros?" + params.toString(), {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.msg || "Error al exportar");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registros.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

  } catch(err) {
    console.error("Error exportando Excel:", err);
    alert("Error descargando el archivo");
  }
});

// ----------------- Event listeners -----------------
document.getElementById("fechaFiltro").addEventListener("change", cargarRegistros);
document.getElementById("busquedaNombre").addEventListener("input", cargarRegistros);

// ----------------- Inicializar -----------------
cargarPersonas();
cargarRegistros();
