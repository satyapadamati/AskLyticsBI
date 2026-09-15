// DashboardView.jsx — Fixed FilterSelect crash + solid backgrounds
import { useState, useEffect } from "react";
import { api, downloadBlob } from "../api";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList
} from "recharts";

const COLORS = ['#60a5fa','#34d399','#fbbf24','#f87171',
                '#a78bfa','#22d3ee','#fb923c','#f472b6'];
const G = ['#1e3a8a','#065f46','#7c3aed','#92400e'];
const L = ['#2563eb','#10b981','#a78bfa','#f59e0b'];

function fmt(v) {
  try {
    const n = Number(v);
    if (isNaN(n)) return String(v ?? "");
    if (Math.abs(n) >= 1e6) return `${(n/1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `${(n/1e3).toFixed(1)}K`;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  } catch { return String(v ?? ""); }
}

const TT = {
  contentStyle:{background:"#111827",border:"1px solid #60a5fa",
    borderRadius:"8px",color:"#f8fafc",fontSize:"12px"},
  labelStyle:{color:"#e2e8f0"},
  itemStyle:{color:"#bfdbfe"},
};

// ── FIX: FilterSelect — safely handles undefined/empty options ──
function FilterSelect({ label, value, options, onChange }) {
  // Always ensure options is a valid array — crash was caused by undefined
  const safeOptions = Array.isArray(options) ? options : [];

  return (
    <div style={{flex:1, minWidth:"120px"}}>
      <div style={{fontSize:"10px", color:"#63b3ed", marginBottom:"5px",
                   fontWeight:600, textTransform:"uppercase",
                   letterSpacing:"0.06em"}}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width        :"100%",
          background   :"#0d1427",
          border       :"1px solid #2b4c7e",
          borderRadius :"8px",
          padding      :"7px 10px",
          color        :"#e2e8f0",
          fontSize     :"12px",
          outline      :"none",
          cursor       :"pointer",
        }}>
        <option value="All" style={{background:"#0d1427"}}>All</option>
        {safeOptions.map(o => (
          <option key={String(o)} value={String(o)}
            style={{background:"#0d1427"}}>
            {String(o)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── TileChart ────────────────────────────────────────────
function TileChart({ item }) {
  // FIX: Dashboard tiles use ONLY their own saved settings, not global chat settings
  const data        = item.data         || [];
  const fixed_ctype = item.fixed_ctype  || "bar";
  const cfg         = item.cfg          || {};
  const num_columns = item.num_columns  || [];
  const text_columns= item.text_columns || [];
  const columns     = item.columns      || [];

  // FIX: Use tile's saved chart type — NO global override
  const ctype = fixed_ctype || cfg.chart_type || "bar";

  const xCol   = cfg.x_axis || text_columns[0] || columns[0];
  const numCols= num_columns;
  const h      = 240;
  
  // FIX: Use tile's saved settings if available, otherwise defaults
  const tileSettings = item.saved_settings || {};
  const showL  = tileSettings.showLabels   ?? item.saved_show_labels ?? true;
  const fsz    = tileSettings.fontSize     || 11;
  const showG  = tileSettings.showGridlines ?? true;
  const showLg = tileSettings.showLegend   ?? true;
  const gridC  = showG ? "rgba(148,163,184,0.3)" : "transparent";

  if (!data.length) {
    return (
      <div style={{padding:"30px", textAlign:"center",
                   color:"#4a5568", fontSize:"12px"}}>
        No data
      </div>
    );
  }

  if (ctype === "kpi_cards") {
    return (
      <div style={{display:"flex",gap:"8px",flexWrap:"wrap",padding:"8px"}}>
        {data.slice(0,4).map((row,j) => (
          <div key={j} style={{
            flex:1, minWidth:"70px", borderRadius:"8px",
            padding:"10px", color:"white", textAlign:"center",
            background:`linear-gradient(135deg,${G[j%4]},${L[j%4]})`,
          }}>
            <div style={{fontSize:"9px",fontWeight:700,opacity:0.85,
                         textTransform:"uppercase",marginBottom:"4px"}}>
              {String(row[text_columns[0]] || "")}
            </div>
            <div style={{fontSize:"1.1rem",fontWeight:700}}>
              {fmt(row[numCols[0]])}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (ctype === "pie" || ctype === "donut") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <PieChart>
          <Pie data={data} dataKey={numCols[0]} nameKey={xCol}
            cx="50%" cy="50%"
            innerRadius={ctype==="donut"?50:0} outerRadius={80}
            label={showL ? ({name, value, percent}) => 
              `${name}: ${fmt(value)} (${(percent*100).toFixed(0)}%)` : false}
            labelLine={showL}
            distance={10}
            labelStyle={{fontSize: 9, fill: '#e2e8f0'}}>
            {data.map((_,i) =>
              <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
          </Pie>
          <Tooltip {...TT} formatter={v=>[fmt(v)]}/>
          {showLg && !showL && <Legend wrapperStyle={{color:"#a0aec0",
            fontSize:`${fsz-1}px`}}/>}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (ctype === "line") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
          <XAxis dataKey={xCol}
            tick={{fill:"#cbd5e1",fontSize:fsz-1}}
            angle={data.length>6?-30:0}
            textAnchor={data.length>6?"end":"middle"}
            height={data.length>6?50:25}/>
          <YAxis tickFormatter={fmt}
            tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
          <Tooltip {...TT} formatter={v=>[fmt(v)]}/>
          {showLg && <Legend wrapperStyle={{color:"#a0aec0",
            fontSize:`${fsz-1}px`}}/>}
          {numCols.map((nc,i) => (
            <Line key={nc} type="monotone" dataKey={nc}
              stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{r:3}}>
              {showL && <LabelList dataKey={nc} position="top"
                formatter={fmt}
                style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`}}/>}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (ctype === "area") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
          <XAxis dataKey={xCol}
            tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
          <YAxis tickFormatter={fmt}
            tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
          <Tooltip {...TT} formatter={v=>[fmt(v)]}/>
          <Area type="monotone" dataKey={numCols[0]}
            stroke={COLORS[0]} fill={`${COLORS[0]}33`} strokeWidth={2}>
            {showL && <LabelList dataKey={numCols[0]} position="top" formatter={fmt}
              style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`}}/>}
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (ctype === "horizontal_bar") {
    return (
      <ResponsiveContainer width="100%"
        height={Math.max(h, data.length*35)}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
          <XAxis type="number" tickFormatter={fmt}
            tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
          <YAxis type="category" dataKey={xCol} width={100}
            tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
          <Tooltip {...TT} formatter={v=>[fmt(v)]}/>
          <Bar dataKey={numCols[0]} fill={COLORS[0]}
            radius={[0,2,2,0]}>
            {showL && <LabelList dataKey={numCols[0]}
              position="right" formatter={fmt}
              style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`}}/>}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar / grouped bar
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
        <XAxis dataKey={xCol}
          tick={{fill:"#cbd5e1",fontSize:fsz-1}}
          angle={data.length>6?-30:0}
          textAnchor={data.length>6?"end":"middle"}
          height={data.length>6?50:25}/>
        <YAxis tickFormatter={fmt}
          tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
        <Tooltip {...TT} formatter={(v,n) => [fmt(v),n]}/>
        {showLg && <Legend wrapperStyle={{color:"#a0aec0",
          fontSize:`${fsz-1}px`,paddingTop:"8px"}}/>}
        {numCols.map((nc,i) => (
          <Bar key={nc} dataKey={nc}
            fill={COLORS[i%COLORS.length]} radius={[2,2,0,0]}>
            {showL && <LabelList dataKey={nc} position="top"
              formatter={fmt}
              style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`,
                      fontWeight:600}}/>}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main DashboardView ──────────────────────────────────
export default function DashboardView({
  dashItems, setDashItems, kpis: kpisFromApp,
  onDeleteTile, onQuestion, settings
}) {
  // FIX: all filter state initialised as empty arrays (never undefined)
  const [filters, setFilters] = useState({ functions:[], roles:[], statuses:[], years:[] });
  const [selFunc, setSelFunc] = useState("All");
  const [selRole, setSelRole] = useState("All");
  const [selStatus, setSelStatus] = useState("All");
  const [selYear, setSelYear] = useState("All");
  const [kpis,       setKpis]       = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [exporting,  setExporting]  = useState("");
  const [dragSrcIdx, setDragSrcIdx] = useState(null);
  const [dragOver,   setDragOver]   = useState(null);
  const [fullData,   setFullData]   = useState([]);  
  // Load filter options AND full data once on mount
  useEffect(() => {
    api.filters()
       .then(d => {
         // FIX: safely set with fallback to empty arrays
         setFilters({
           functions: Array.isArray(d.functions) ? d.functions : [],
           roles     : Array.isArray(d.roles)     ? d.roles     : [],
           statuses  : Array.isArray(d.statuses)  ? d.statuses  : [],
           years     : Array.isArray(d.years)      ? d.years     : [],
         });
       })
       .catch(() => {
         setFilters({functions:[],roles:[],statuses:[],years:[]});
       });

    // NEW: Load full dataset for client-side filtering
    api.fullData()
       .then(d => {
         setFullData(d.data || []);
       })
       .catch(() => {
         setFullData([]);
       });
  }, []);  

  // Reload KPIs AND filter tiles when filters change
  useEffect(() => {
    // ✅ Call backend KPI endpoint (this works correctly)
    setKpiLoading(true);
    api.kpisFiltered(selFunc, selRole, selStatus, selYear)
       .then(d => {
         console.log('[Dashboard] KPIs received:', d);
         setKpis({
           total_demand    : Number(d.total_demand     || 0),
           total_capacity  : Number(d.total_capacity   || 0),
           total_gap       : Number(d.total_gap        || 0),
           avg_utilization : Number(d.avg_utilization  || 0),
           at_risk_projects: Number(d.at_risk_projects || 0),
         });
       })
       .catch(err => {
         console.error('[Dashboard] KPI error:', err);
         if (kpisFromApp) setKpis(kpisFromApp);
       })
       .finally(() => setKpiLoading(false));

    // Apply filters to tiles client-side — ALWAYS filter from originalData
    if (dashItems.length > 0) {
      const filteredItems = dashItems.map(item => {
        const sourceData = item.originalData || item.data || [];

        const filteredData = sourceData.filter(row => {
          const functionVal = row.FUNCTION ?? row.function;
          const roleVal = row.ROLE ?? row.role;
          const statusVal = row.PROJECT_STATUS ?? row.project_status;
          const dateVal = row.DATE ?? row.date;

          if (selFunc !== "All" && functionVal !== selFunc) return false;
          if (selRole !== "All" && roleVal !== selRole) return false;
          if (selStatus !== "All" && statusVal !== selStatus) return false;
          if (selYear !== "All" && dateVal) {
            const rowYear = new Date(dateVal).getFullYear();
            if (rowYear !== parseInt(selYear, 10)) return false;
          }
          return true;
        });

        return {
          ...item,
          originalData: sourceData,
          data: filteredData,
        };
      });

      setDashItems(filteredItems);
    }
  }, [selFunc, selRole, selStatus, selYear]);  

  // Drag handlers
  const onDragStart = idx => setDragSrcIdx(idx);
  const onDragOver  = idx => setDragOver(idx);
  const onDrop      = targetIdx => {
    if (dragSrcIdx === null || dragSrcIdx === targetIdx) {
      setDragSrcIdx(null); setDragOver(null); return;
    }
    const list = [...dashItems];
    const [moved] = list.splice(dragSrcIdx, 1);
    list.splice(targetIdx, 0, moved);
    setDashItems(list);
    setDragSrcIdx(null); setDragOver(null);
  };

  // Export
  const handlePdf = async () => {
    setExporting("pdf");
    try {
      const payload = dashItems.map(item => ({
        tile_id:item.tile_id, title:item.title,
        fixed_ctype:item.fixed_ctype,
        saved_show_labels:item.saved_show_labels ?? true,
        data:item.data, cfg:item.cfg,
        columns:item.columns, num_columns:item.num_columns,
        text_columns:item.text_columns,
      }));
      const blob = await api.exportDashPdf(payload);
      if (!blob || blob.size === 0) throw new Error("Empty PDF");
      downloadBlob(blob, "dashboard.pdf");
    } catch(e) { alert("PDF failed: " + (e.message || e)); }
    finally    { setExporting(""); }
  };

  const handleExcel = async () => {
    setExporting("excel");
    try {
      const payload = dashItems.map(item => ({
        tile_id:item.tile_id, title:item.title,
        fixed_ctype:item.fixed_ctype,
        saved_show_labels:item.saved_show_labels ?? true,
        data:item.data, cfg:item.cfg,
        columns:item.columns, num_columns:item.num_columns,
        text_columns:item.text_columns,
      }));
      const blob = await api.exportDashExcel(payload);
      downloadBlob(blob, "dashboard.xlsx");
    } catch(e) { alert("Excel failed: " + (e.message || e)); }
    finally    { setExporting(""); }
  };

  const displayKpis = kpis || kpisFromApp;
  const kpiCards = [
    { lbl:"📊 TOTAL DEMAND",
      val: kpiLoading ? "..." : fmt(displayKpis?.total_demand || 0),
      sub:"All functions",
      bg:"linear-gradient(135deg,#1e3a8a,#2563eb)" },
    { lbl:"⚡ TOTAL CAPACITY",
      val: kpiLoading ? "..." : fmt(displayKpis?.total_capacity || 0),
      sub:"Available",
      bg:"linear-gradient(135deg,#065f46,#10b981)" },
    { lbl:"📉 DEMAND GAP",
      val: kpiLoading ? "..." : fmt(displayKpis?.total_gap || 0),
      sub:"Demand − Capacity",
      bg:"linear-gradient(135deg,#7c2d12,#ef4444)" },
    { lbl:"📈 AVG UTILIZATION",
      val: kpiLoading ? "..." :
        `${Number(displayKpis?.avg_utilization || 0).toFixed(1)}%`,
      sub:"Consumed %",
      bg:"linear-gradient(135deg,#7c3aed,#a78bfa)" },
    { lbl:"⚠️ AT-RISK",
      val: kpiLoading ? "..." :
        String(displayKpis?.at_risk_projects || 0),
      sub:"Need attention",
      bg:"linear-gradient(135deg,#92400e,#f59e0b)" },
  ];

  return (
    <div style={{
      display      :"flex",
      flexDirection:"column",
      height       :"100%",
      overflow     :"hidden",
      background   :"#080c18",
    }}>

      {/* Header */}
      <div style={{
        padding        :"12px 20px",
        background     :"linear-gradient(90deg,#0d1a3a,#1a2a5a)",
        borderBottom   :"1px solid #1e3a5a",
        flexShrink     :0,
        display        :"flex",
        alignItems     :"center",
        justifyContent :"space-between",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"15px",fontWeight:700,color:"white"}}>
            📊 Dashboard
          </span>
          <span style={{background:"rgba(99,179,237,0.15)",
                        color:"#63b3ed",fontSize:"11px",
                        padding:"2px 10px",borderRadius:"10px",
                        border:"1px solid #2b4c7e"}}>
            {dashItems.length} / 12 tiles
          </span>
        </div>
        <span style={{fontSize:"11px",color:"#4a5568"}}>
          ✕ remove &nbsp;•&nbsp; ☰ drag to reorder
        </span>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex      :"1 1 0",
        overflowY :"auto",
        overflowX :"hidden",
        padding   :"16px 20px",
        background:"#080c18",
      }}>

        {/* Filters */}
        <div style={{
          background   :"#0d1427",
          border       :"1px solid #1e3a5a",
          borderRadius :"10px",
          padding      :"12px 16px",
          marginBottom :"14px",
        }}>
          <div style={{fontSize:"11px",fontWeight:700,color:"#63b3ed",
                       marginBottom:"10px",textTransform:"uppercase",
                       letterSpacing:"0.06em"}}>
            🔍 Dashboard Filters
          </div>
          <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
            <FilterSelect label="Function"
              value={selFunc}
              options={filters.functions}
              onChange={setSelFunc}/>
            <FilterSelect label="Role"
              value={selRole}
              options={filters.roles}
              onChange={setSelRole}/>
            <FilterSelect label="Project Status"
              value={selStatus}
              options={filters.statuses}
              onChange={setSelStatus}/>
            <FilterSelect label="Year"
              value={selYear}
              options={filters.years}
              onChange={setSelYear}/>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{display:"flex",gap:"10px",
                     marginBottom:"16px",flexWrap:"nowrap"}}>
          {kpiCards.map((k,i) => (
            <div key={i} style={{
              flex        :1,
              borderRadius:"12px",
              padding     :"12px 14px",
              color       :"white",
              background  :k.bg,
              minWidth    :"80px",
              boxShadow   :"0 4px 16px rgba(0,0,0,0.4)",
            }}>
              <div style={{fontSize:"9px",fontWeight:700,
                           textTransform:"uppercase",
                           letterSpacing:"0.07em",
                           opacity:0.85,marginBottom:"5px"}}>
                {k.lbl}
              </div>
              <div style={{fontSize:"1.5rem",fontWeight:800,
                           lineHeight:1.1}}>{k.val}</div>
              <div style={{fontSize:"9px",opacity:0.72,
                           marginTop:"3px"}}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Tiles grid */}
        {dashItems.length === 0 ? (
          <div style={{
            textAlign   :"center",
            padding     :"60px 20px",
            background  :"#0d1427",
            borderRadius:"12px",
            border      :"1px dashed #1e3a5a",
          }}>
            <div style={{fontSize:"36px",marginBottom:"12px"}}>📊</div>
            <div style={{fontSize:"15px",color:"#718096",
                         marginBottom:"6px"}}>
              Dashboard is empty
            </div>
            <div style={{fontSize:"12px",color:"#4a5568"}}>
              Generate a visual then click "Add to Dashboard"
            </div>
          </div>
        ) : (
          <div style={{
            display            :"grid",
            gridTemplateColumns:"1fr 1fr",
            gap                :"14px",
          }}>
            {dashItems.map((item, idx) => (
              <div
                key={item.tile_id}
                draggable
                onDragStart={()  => onDragStart(idx)}
                onDragOver ={e => { e.preventDefault(); onDragOver(idx); }}
                onDrop     ={e => { e.preventDefault(); onDrop(idx); }}
                style={{
                  background   :"#0d1427",
                  border       : dragOver===idx
                    ? "2px solid #2b6cb0"
                    : "1px solid #1e3a5a",
                  borderRadius :"10px",
                  overflow     :"hidden",
                  cursor       :"grab",
                  boxShadow    :"0 4px 16px rgba(0,0,0,0.5)",
                }}>

                {/* Tile header */}
                <div style={{
                  background    :"linear-gradient(90deg,#0d1a3a,#1a2a5a)",
                  padding       :"8px 12px",
                  display       :"flex",
                  alignItems    :"center",
                  justifyContent:"space-between",
                  userSelect    :"none",
                  borderBottom  :"1px solid #1e3a5a",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{color:"#2b4c7e",fontSize:"13px"}}>☰</span>
                    <span style={{
                      color         :"white",
                      fontSize      :"11px",
                      fontWeight    :600,
                      whiteSpace    :"nowrap",
                      overflow      :"hidden",
                      textOverflow  :"ellipsis",
                      maxWidth      :"220px",
                    }}>
                      {item.title}
                    </span>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteTile(item.tile_id);
                    }}
                    style={{
                      background :"none",
                      border     :"none",
                      color      :"rgba(255,255,255,0.4)",
                      cursor     :"pointer",
                      fontSize   :"14px",
                      padding    :"0 2px",
                      lineHeight :1,
                      transition :"color 0.15s",
                      flexShrink :0,
                    }}
                    onMouseEnter={e =>
                      e.currentTarget.style.color="#fc8181"}
                    onMouseLeave={e =>
                      e.currentTarget.style.color="rgba(255,255,255,0.4)"}>
                    ✕
                  </button>
                </div>

                {/* Chart only */}
                <div style={{padding:"12px",background:"#0d1427"}}>
                  <TileChart item={item}/>
                </div>

                <div style={{textAlign:"center",fontSize:"10px",
                             color:"#1e3a5a",padding:"4px",
                             background:"#080c18"}}>
                  ☰ drag to reorder
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Download section */}
        {dashItems.length > 0 && (
          <div style={{marginTop:"20px",paddingTop:"16px",
                       borderTop:"1px solid #1e3a5a"}}>
            <div style={{fontSize:"13px",fontWeight:600,
                         color:"#e2e8f0",marginBottom:"10px"}}>
              ⬇️ Download Dashboard
            </div>
            <div style={{display:"flex",gap:"10px"}}>
              <button onClick={handlePdf} disabled={!!exporting}
                style={{padding:"9px 18px",background:"#0d1427",
                        border:"1px solid #2b4c7e",borderRadius:"8px",
                        color:"#a0aec0",fontSize:"12px",
                        cursor:exporting?"not-allowed":"pointer"}}>
                {exporting==="pdf" ? "⏳ Building..." : "📄 Download PDF"}
              </button>
              <button onClick={handleExcel} disabled={!!exporting}
                style={{padding:"9px 18px",background:"#0d1427",
                        border:"1px solid #2b4c7e",borderRadius:"8px",
                        color:"#a0aec0",fontSize:"12px",
                        cursor:exporting?"not-allowed":"pointer"}}>
                {exporting==="excel" ? "⏳ Building..." : "📊 Download Excel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
