const token = localStorage.getItem("token");
const registrosBody = document.getElementById("registrosBody");
const fechaFiltro = document.getElementById("fechaFiltro");
const busquedaNombre = document.getElementById("busquedaNombre");
const busquedaSede = document.getElementById("busquedaSede");
const exportBtn = document.getElementById("exportExcel");

let grafico;

// =====================
// CARGAR ASISTENCIAS CON FILTROS
// =====================
async function cargarAsistencias() {
  try {
    const fecha = fechaFiltro.value;
    const nombre = busquedaNombre.value.trim();
    const sede = busquedaSede.value.trim();

    let url = "/asistencias?";
    const params = [];

    if (fecha) params.push("fecha=" + fecha);
    if (nombre) params.push("nombre=" + encodeURIComponent(nombre));
    if (sede) params.push("sede=" + encodeURIComponent(sede));

    url += params.join("&");

    const res = await fetch(url, {
      headers: { "Authorization": "Bearer " + token }
    });

    if (!res.ok) throw new Error("Error al cargar registros");

    const data = await res.json();
    renderTabla(data);
    renderGrafico(data);
  } catch (err) {
    console.error(err);
  }
}

// =====================
// RENDER TABLA CON COLORES
// =====================
function renderTabla(data) {
  registrosBody.innerHTML = "";
  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.className = r.tipo; // usar clase para colorear
    tr.innerHTML = `
      <td>${r.nombre}</td>
      <td>${r.sede}</td>
      <td>${r.tipo}</td>
      <td>${new Date(r.fecha).toLocaleString()}</td>
    `;
    registrosBody.appendChild(tr);
  });
}

// =====================
// RENDER GRAFICO
// =====================
function renderGrafico(data) {
  const conteo = {
    entrada: 0,
    salida: 0,
    descanso_salida: 0,
    descanso_entrada: 0
  };

  data.forEach(r => {
    if (conteo[r.tipo] !== undefined) conteo[r.tipo]++;
  });

  const ctx = document.getElementById("graficoAsistencias").getContext("2d");
  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Entrada", "Salida", "Descanso Salida", "Descanso Entrada"],
      datasets: [{
        label: "Cantidad",
        data: [
          conteo.entrada,
          conteo.salida,
          conteo.descanso_salida,
          conteo.descanso_entrada
        ],
        backgroundColor: [
          "#0d6efd", "#dc3545", "#ffc107", "#198754"
        ]
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

// =====================
// EXPORTAR EXCEL CON FILTROS
// =====================
exportBtn.addEventListener("click", () => {
  const fecha = fechaFiltro.value;
  const nombre = busquedaNombre.value.trim();
  const sede = busquedaSede.value.trim();

  let url = "/exportar-registros?";
  const params = [];

  if (fecha) params.push("fecha=" + fecha);
  if (nombre) params.push("nombre=" + encodeURIComponent(nombre));
  if (sede) params.push("sede=" + encodeURIComponent(sede));

  url += params.join("&");
  window.open(url, "_blank");
});

// =====================
// FILTROS REACTIVOS
// =====================
fechaFiltro.addEventListener("change", cargarAsistencias);
busquedaNombre.addEventListener("input", cargarAsistencias);
busquedaSede.addEventListener("input", cargarAsistencias);

// =====================
// INICIALIZAR
// =====================
window.addEventListener("load", cargarAsistencias);