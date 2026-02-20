// admin.js - Panel administrativo corregido y optimizado
document.addEventListener("DOMContentLoaded", () => {

  const token = localStorage.getItem("token");
  if(!token){ window.location.href = "login.html"; return; }

  const registrosBody = document.getElementById("registrosBody");
  const personasBody = document.getElementById("personasBody");
  const fechaFiltro = document.getElementById("fechaFiltro");
  const busquedaGeneral = document.getElementById("busquedaGeneral");
  const exportBtn = document.getElementById("exportExcel");
  let chart;

  // ---------------- LOGOUT ----------------
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href="login.html";
  });

  // ---------------- CARGAR PERSONAS ----------------
  async function cargarPersonas() {
    try {
      const res = await fetch("/personas", { headers:{ "Authorization": `Bearer ${token}` } });
      const personas = await res.json();
      personasBody.innerHTML = "";
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
            method:"POST",
            headers:{ "Authorization": `Bearer ${token}` }
          });
          cargarPersonas();
        });
        personasBody.appendChild(tr);
      });
    } catch(e){ console.error("Error cargando personas:", e); }
  }

  async function cargarRegistros() {
  try {
    const fecha = fechaFiltro.value;
    const busqueda = busquedaGeneral.value.trim().toLowerCase();
    const params = new URLSearchParams();

    if (fecha) params.append("fecha", fecha);

    // Si hay búsqueda, enviamos como un solo parámetro 'busqueda' al backend
    if (busqueda) params.append("busqueda", busqueda);

    const res = await fetch("/asistencias?" + params.toString(), {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) {
      console.error("Error al cargar registros:", res.statusText);
      registrosBody.innerHTML = `<tr><td colspan="4">No se pudieron cargar los registros.</td></tr>`;
      return;
    }

    const registros = await res.json();
    registrosBody.innerHTML = "";

    if (registros.length === 0) {
      registrosBody.innerHTML = `<tr><td colspan="4">No hay registros que coincidan con los filtros.</td></tr>`;
    } else {
      registros.forEach(r => {
        const tr = document.createElement("tr");
        tr.className = r.tipo;
        tr.innerHTML = `
          <td>${r.nombre}</td>
          <td>${r.sede}</td>
          <td>${r.tipo}</td>
          <td>${new Date(r.fecha).toLocaleString()}</td>
        `;
        registrosBody.appendChild(tr);
      });
    }

    // Actualizamos gráfico
    actualizarGrafico(registros);

  } catch (e) {
    console.error("Error cargando registros:", e);
    registrosBody.innerHTML = `<tr><td colspan="4">Ocurrió un error al cargar los registros.</td></tr>`;
  }
}

  // ---------------- ACTUALIZAR GRÁFICO ----------------
  function actualizarGrafico(data){
    const ctx = document.getElementById("graficoAsistencias").getContext("2d");
    const tipos = ["entrada","salida","descanso_salida","descanso_entrada"];
    const counts = tipos.map(t => data.filter(r => r.tipo===t).length);

    if(chart) chart.destroy(); // Evitar error "canvas already in use"
    chart = new Chart(ctx, {
      type:"bar",
      data:{
        labels:["Entrada","Salida","Descanso Salida","Descanso Entrada"],
        datasets:[{
          label:"Cantidad",
          data:counts,
          backgroundColor:["#0d6efd","#dc3545","#ffc107","#198754"]
        }]
      },
      options:{ responsive:true, plugins:{ legend:{ display:false } } }
    });
  }

  // ---------------- EXPORTAR EXCEL ----------------
  exportBtn.addEventListener("click", async () => {
    const fecha = fechaFiltro.value;
    const busqueda = busquedaGeneral.value.trim().toLowerCase();
    const params = new URLSearchParams();
    if(fecha) params.append("fecha", fecha);
    if(busqueda){
      params.append("nombre", busqueda);
      params.append("sede", busqueda);
      params.append("tipo", busqueda);
    }

    const res = await fetch("/exportar-registros?" + params.toString(), {
      headers:{ "Authorization": `Bearer ${token}` }
    });

    if(!res.ok){
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
  });

  // ---------------- EVENTOS FILTROS ----------------
  fechaFiltro.addEventListener("input", cargarRegistros);
  busquedaGeneral.addEventListener("input", cargarRegistros);

  // ---------------- INICIALIZAR ----------------
  cargarPersonas();
  cargarRegistros();

});