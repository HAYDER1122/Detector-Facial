document.addEventListener("DOMContentLoaded", () => {

  const token = localStorage.getItem("token");
  if(!token){ window.location.href="login.html"; return; }

  const registrosBody = document.getElementById("registrosBody");
  const personasBody = document.getElementById("personasBody");
  const fechaFiltro = document.getElementById("fechaFiltro");
  const busquedaGeneral = document.getElementById("busquedaGeneral");
  let chart;

  // ---------------- FUNCIONES ----------------
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
        tr.querySelector(".toggleBtn").addEventListener("click", async ()=>{
          await fetch(`/personas/${p.id}/toggle`, { method:"POST", headers:{ "Authorization": `Bearer ${token}` } });
          cargarPersonas();
        });
        personasBody.appendChild(tr);
      });
    } catch(e){ console.error("Error cargando personas:", e); }
  }

  async function cargarRegistros() {
    try {
      const fecha = fechaFiltro.value;
      const busqueda = busquedaGeneral.value.trim();
      const params = new URLSearchParams();
      if(fecha) params.append("fecha", fecha);
      if(busqueda) {
        params.append("nombre", busqueda);
        params.append("sede", busqueda);
        params.append("tipo", busqueda.toLowerCase());
      }

      const res = await fetch("/asistencias?" + params.toString(), { headers:{ "Authorization": `Bearer ${token}` } });
      const registros = await res.json();

      // Render tabla
      registrosBody.innerHTML = "";
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

      // Render gráfico
      actualizarGrafico(registros);
    } catch(e){ console.error("Error cargando registros:", e); }
  }

  function actualizarGrafico(data){
    const ctx = document.getElementById("graficoAsistencias");
    const tipos = ["entrada","salida","descanso_salida","descanso_entrada"];
    const counts = tipos.map(t => data.filter(r => r.tipo===t).length);
    if(chart) chart.destroy();
    chart = new Chart(ctx,{
      type:"bar",
      data:{ labels:tipos, datasets:[{label:"Cantidad", data:counts, backgroundColor:["#0d6efd","#dc3545","#ffc107","#198754"]}] },
      options:{ responsive:true, plugins:{ legend:{ display:false } } }
    });
  }

  // ---------------- EXPORTAR EXCEL ----------------
  document.getElementById("exportExcel").addEventListener("click", ()=>{
    const fecha = fechaFiltro.value;
    const busqueda = busquedaGeneral.value.trim();
    const params = new URLSearchParams();
    if(fecha) params.append("fecha", fecha);
    if(busqueda) { params.append("nombre", busqueda); params.append("sede", busqueda); params.append("tipo", busqueda.toLowerCase()); }
    window.open("/exportar-registros?" + params.toString(), "_blank");
  });

  // ---------------- FILTROS ----------------
  fechaFiltro.addEventListener("input", cargarRegistros);
  busquedaGeneral.addEventListener("input", cargarRegistros);

  // ---------------- LOGOUT ----------------
  document.getElementById("logoutBtn").addEventListener("click", ()=>{
    localStorage.removeItem("token");
    window.location.href="login.html";
  });

  // ---------------- INICIALIZAR ----------------
  cargarPersonas();
  cargarRegistros();

});