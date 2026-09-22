// api.js — All calls to your PostgreSQL FastAPI backend
const BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000/api").replace(/\/$/, "");

const authHeaders = () => {
  const token = localStorage.getItem("asklyticsbi_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const get = async (url) => {
  const r = await fetch(BASE + url, { headers: authHeaders() });
  if (!r.ok) {
    let payload = null;
    try { payload = await r.json(); } catch { /* Response was not JSON. */ }
    throw payload || { detail: `Request failed: ${r.status}` };
  }
  return r.json();
};

const post = (url,body) =>
  fetch(BASE+url,{
    method :"POST",
    headers:{"Content-Type":"application/json", ...authHeaders()},
    body   :JSON.stringify(body)
  }).then(r=>{
    if(!r.ok) return r.json().then(e=>{throw e;});
    return r.json();
  });

export const api = {
  login: credentials => post("/auth/login", credentials),
  register: credentials => post("/auth/register", credentials),
  me: () => get("/auth/me"),
  logout: () => post("/auth/logout", {}),

  // Health check
  health: () => get("/health"),

  // Schema
  schema: () => get("/schema"),

  // Chart types list
  chartTypes: () => get("/chart-types"),

  // Quick questions (8 preset questions)
  quickQuestions: () => get("/quick-questions"),

  // KPI values from PostgreSQL
  kpis: () => get("/kpis"),

  // Filter options (function, role, status, year)
  filters: () => get("/filters").catch(()=>({
    functions:[],roles:[],statuses:[],years:[]
  })),

  // Full dataset for client-side dashboard tile filtering
  fullData: () => get("/full-data").catch(()=>({
    data:[], columns:[]
  })),

  // KPIs filtered by dashboard dropdowns
  kpisFiltered: (func,role,status,year) =>
    post("/kpis/filtered",{
      function: func   || "All",
      role    : role   || "All",
      status  : status || "All",
      year    : year   || "All",
    }).catch(()=>({
      total_demand:0,total_capacity:0,
      total_gap:0,avg_utilization:0,at_risk_projects:0
    })),

  // Main AI query — question → SQL → data → chart → summary
  query: (question,chatHistory,chartType,showLabels,labelPos) =>
    post("/query",{
      question           : question,
      chat_history       : chatHistory||[],
      chart_type_override: chartType||"Auto (AI decides)",
      show_data_labels   : showLabels??true,
      label_position     : labelPos||"outside",
    }),

  // Run custom SQL from SQL tab
  runSql: sql => post("/run-sql",{sql}),

  // Single chart exports
  exportChartPdf: (data,chartType,title,showLabels) =>
    fetch(BASE+"/export/chart-pdf",{
      method:"POST",
      headers:{"Content-Type":"application/json", ...authHeaders()},
      body:JSON.stringify({data,chart_type:chartType,
                           title,show_labels:showLabels})
    }).then(r=>r.blob()),

  exportChartExcel: (data,title) =>
    fetch(BASE+"/export/chart-excel",{
      method:"POST",
      headers:{"Content-Type":"application/json", ...authHeaders()},
      body:JSON.stringify({data,title})
    }).then(r=>r.blob()),

  // Full dashboard exports
  exportDashPdf: items =>
    fetch(BASE+"/export/dashboard-pdf",{
      method:"POST",
      headers:{"Content-Type":"application/json", ...authHeaders()},
      body:JSON.stringify({items})
    }).then(r=>r.blob()),

  exportDashExcel: items =>
    fetch(BASE+"/export/dashboard-excel",{
      method:"POST",
      headers:{"Content-Type":"application/json", ...authHeaders()},
      body:JSON.stringify({items})
    }).then(r=>r.blob()),
};

// Helper — download a blob as a file
export function downloadBlob(blob,filename){
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href=url; a.download=filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}