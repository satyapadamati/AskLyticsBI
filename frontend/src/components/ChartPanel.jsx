import { useState } from "react";
import { api, downloadBlob } from "../api";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList
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

// FIX 2: This function resolves chart type — sidebar override WINS over AI suggestion
function resolveChartType(settings, chart_config, num_columns) {
  const override = settings?.chartType;
  // If user selected something other than Auto — USE IT
  if (override && override !== "Auto (AI decides)") {
    return override.toLowerCase().replace(/ /g, "_");
  }
  // Otherwise use AI suggestion
  let ctype = chart_config?.chart_type || "bar";
  // Auto-upgrade bar to grouped_bar if multiple numeric columns
  if (ctype === "bar" && num_columns && num_columns.length >= 2) {
    ctype = "grouped_bar";
  }
  return ctype;
}

export default function ChartPanel({ result, activeQ, onQuestion, settings }) {
  const [downloading, setDownloading] = useState("");

  const {
    data, columns, num_columns, text_columns,
    chart_config, summary_data, row_count
  } = result;

  // FIX 2: Always use resolveChartType — sidebar override is respected
  const ctype  = resolveChartType(settings, chart_config, num_columns);
  const title  = chart_config?.title || activeQ || "Query Results";
  const xCol   = chart_config?.x_axis || text_columns?.[0] || columns?.[0];
  const numCols= num_columns || [];
  const h         = settings?.chartHeight || 420;
  const showL     = settings?.showLabels  ?? true;
  const labelPos  = settings?.labelPos    || "outside";
  const fsz       = settings?.fontSize    || 13;
  const titleSize = settings?.titleSize   || 16; 
  const showG     = settings?.showGridlines ?? true;
  const showLg    = settings?.showLegend  ?? true;
  const gridC     = showG ? "rgba(148,163,184,0.35)" : "transparent";  
  
  const handleDownloadExcel = async () => {
    setDownloading("excel");
    try {
      const blob = await api.exportChartExcel(data, title);
      downloadBlob(blob, `${title.slice(0,20)}.xlsx`);
    } catch(e) { alert("Excel failed: "+e); }
    finally { setDownloading(""); }
  };

  const handleDownloadPdf = async () => {
    setDownloading("pdf");
    try {
      const blob = await api.exportChartPdf(data, ctype, title, showL);
      downloadBlob(blob, `${title.slice(0,20)}.pdf`);
    } catch(e) { alert("PDF failed: "+e); }
    finally { setDownloading(""); }
  };

  // ── KPI Cards ──────────────────────────────────────────
  if (ctype === "kpi_cards") {
    return (
      <div>
        <div style={{fontSize:14,fontWeight:600,color:"#e2e8f0",marginBottom:16}}>{title}</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
          {data.slice(0,4).map((row,j) => (
            <div key={j} style={{flex:1,minWidth:130,borderRadius:12,
              padding:"18px 20px",color:"white",
              background:`linear-gradient(135deg,${G[j%4]},${L[j%4]})`,
              boxShadow:"0 4px 14px rgba(0,0,0,0.3)"}}>
              <div style={{fontSize:"0.7rem",fontWeight:600,textTransform:"uppercase",opacity:0.85,marginBottom:5}}>
                {String(row[text_columns?.[0]] || "")}
              </div>
              <div style={{fontSize:"2rem",fontWeight:700,lineHeight:1.1}}>
                {fmt(row[numCols[0]])}
              </div>
              {numCols.length > 1 && (
                <div style={{fontSize:"0.72rem",opacity:0.78,marginTop:3}}>
                  {fmt(row[numCols[1]])}
                </div>
              )}
            </div>
          ))}
        </div>
        <SummaryBlock sd={summary_data} onQuestion={onQuestion} queryCount={result.queryCount}/>
      </div>
    );
  }

  // ── Table Only ─────────────────────────────────────────
  if (ctype === "table_only") {
    return (
      <div>
        <DataTable data={data} columns={columns} numCols={numCols}/>
        <SummaryBlock sd={summary_data} onQuestion={onQuestion}/>
      </div>
    );
  }

  const renderChart = () => {
    if (!data?.length) return (
      <p style={{color:"#718096",padding:"20px"}}>No data returned</p>
    );

    // ── PIE / DONUT ──────────────────────────────────────
    if (ctype === "pie" || ctype === "donut") {
      const yCol = numCols[0];
      return (
        <ResponsiveContainer width="100%" height={h}>
          <PieChart>
            <Pie data={data} dataKey={yCol} nameKey={xCol}
              cx="50%" cy="50%"
              innerRadius={ctype==="donut" ? Math.floor(h*0.2) : 0}
              outerRadius={Math.floor(h*0.35)}
              label={({name,value,percent}) =>
                `${name}: ${fmt(value)} (${(percent*100).toFixed(1)}%)`}
              labelLine>
              {data.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie>
            <Tooltip {...TT} formatter={v=>[fmt(v)]} cursor={false}/>
            {showLg && <Legend wrapperStyle={{color:"#a0aec0",fontSize:`${fsz-1}px`}}/>}
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // ── LINE ─────────────────────────────────────────────
    if (ctype === "line") {
      return (
        <ResponsiveContainer width="100%" height={h}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
            <XAxis dataKey={xCol} tick={{fill:"#cbd5e1",fontSize:fsz-1}}
              angle={data.length>6?-30:0}
              textAnchor={data.length>6?"end":"middle"}
              height={data.length>6?55:30}/>
            <YAxis tickFormatter={fmt} tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <Tooltip {...TT} formatter={v=>[fmt(v)]} cursor={false}/>
            {showLg && <Legend wrapperStyle={{color:"#a0aec0",fontSize:`${fsz-1}px`,paddingTop:8}}/>}
            {numCols.map((nc,i) => (
              <Line key={nc} type="monotone" dataKey={nc}
                stroke={COLORS[i%COLORS.length]} strokeWidth={2.5} dot={{r:4}}>
                {showL && <LabelList dataKey={nc} position={labelPos === "inside" ? "insideTop" : "top"} formatter={fmt}
                  style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`,fontWeight:600}}/>}                
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // ── AREA ─────────────────────────────────────────────
    if (ctype === "area") {
      return (
        <ResponsiveContainer width="100%" height={h}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
            <XAxis dataKey={xCol} tick={{fill:"#cbd5e1",fontSize:fsz-1}}
              angle={data.length>6?-30:0}
              textAnchor={data.length>6?"end":"middle"}
              height={data.length>6?55:30}/>
            <YAxis tickFormatter={fmt} tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <Tooltip {...TT} formatter={v=>[fmt(v)]} cursor={false}/>
            {showLg && <Legend wrapperStyle={{color:"#a0aec0",fontSize:`${fsz-1}px`,paddingTop:8}}/>}
            {numCols.map((nc,i) => (
              <Area key={nc} type="monotone" dataKey={nc}
                stroke={COLORS[i%COLORS.length]}
                fill={`${COLORS[i%COLORS.length]}33`} strokeWidth={2}>
                {showL && <LabelList dataKey={nc} position={labelPos === "inside" ? "insideTop" : "top"} formatter={fmt}
                  style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`}}/>}
              </Area>
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // ── HORIZONTAL BAR ───────────────────────────────────
    if (ctype === "horizontal_bar") {
      const yCol = numCols[0];
      return (
        <ResponsiveContainer width="100%" height={Math.max(h, data.length*45)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
            <XAxis type="number" tickFormatter={fmt}
              tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <YAxis type="category" dataKey={xCol} width={130}
              tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <Tooltip {...TT} formatter={v=>[fmt(v)]} cursor={false}/>
            <Bar dataKey={yCol} fill={COLORS[0]} radius={[0,3,3,0]}>
              {showL && <LabelList dataKey={yCol} position={labelPos === "inside" ? "insideLeft" : "right"} formatter={fmt}
                style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`,fontWeight:600}}/>}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // ── SCATTER ──────────────────────────────────────────
    if (ctype === "scatter") {
      const xc = numCols[0] || columns[0];
      const yc = numCols[1] || columns[columns.length-1];
      return (
        <ResponsiveContainer width="100%" height={h}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
            <XAxis dataKey={xc} name={xc} tickFormatter={fmt}
              tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <YAxis dataKey={yc} name={yc} tickFormatter={fmt}
              tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <Tooltip {...TT} formatter={v=>[fmt(v)]} cursor={{strokeDasharray:"3 3"}}/>
            <Scatter data={data} fill={COLORS[0]}/>
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    // ── WATERFALL (rendered as bar with cumulative logic) ─
    if (ctype === "waterfall") {
      const yCol = numCols[0];
      let running = 0;
      const wData = data.map(row => {
        const val = Number(row[yCol]) || 0;
        const base = running;
        running += val;
        return { ...row, _base: base, _val: val, _total: running };
      });
      return (
        <ResponsiveContainer width="100%" height={h}>
          <BarChart data={wData} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
            <XAxis dataKey={xCol} tick={{fill:"#cbd5e1",fontSize:fsz-1}}
              angle={data.length>6?-30:0}
              textAnchor={data.length>6?"end":"middle"}
              height={data.length>6?55:30}/>
            <YAxis tickFormatter={fmt} tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <Tooltip {...TT} formatter={(v,n,p)=>[fmt(p.payload._val),yCol]}/>
            <Bar dataKey="_base" stackId="a" fill="transparent"/>
            <Bar dataKey="_val" stackId="a" radius={[3,3,0,0]}
              fill={COLORS[0]}>
              {wData.map((entry,i) => (
                <Cell key={i}
                  fill={entry._val >= 0 ? COLORS[0] : '#ef4444'}/>
              ))}
              {showL && <LabelList dataKey="_val" position={labelPos === "inside" ? "inside" : "top"} formatter={fmt}
                style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`,fontWeight:600}}/>}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // ── FUNNEL (rendered as horizontal bars sorted desc) ──
    if (ctype === "funnel") {
      const yCol = numCols[0];
      const sorted = [...data].sort((a,b) => Number(b[yCol])-Number(a[yCol]));
      return (
        <ResponsiveContainer width="100%" height={Math.max(h, data.length*45)}>
          <BarChart data={sorted} layout="vertical" barCategoryGap="10%">
            <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
            <XAxis type="number" tickFormatter={fmt}
              tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <YAxis type="category" dataKey={xCol} width={130}
              tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
            <Tooltip {...TT} formatter={v=>[fmt(v)]} cursor={false}/>
            <Bar dataKey={yCol} radius={[0,4,4,0]}>
              {sorted.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              {showL && <LabelList dataKey={yCol} position={labelPos === "inside" ? "insideLeft" : "right"} formatter={fmt}
                style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`,fontWeight:600}}/>}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // ── HEATMAP (table-style colour matrix) ───────────────
    if (ctype === "heatmap") {
      if (text_columns?.length >= 2 && numCols.length > 0) {
        const rows  = [...new Set(data.map(r => r[text_columns[0]]))];
        const cols2 = [...new Set(data.map(r => r[text_columns[1]]))];
        const valMap = {};
        data.forEach(r => {
          valMap[`${r[text_columns[0]]}_${r[text_columns[1]]}`] = Number(r[numCols[0]]) || 0;
        });
        const allVals = data.map(r => Number(r[numCols[0]]) || 0);
        const maxV = Math.max(...allVals) || 1;
        return (
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
              <thead>
                <tr>
                  <th style={{padding:"6px 10px",background:"rgba(43,108,176,0.3)",color:"#90cdf4",border:"1px solid #1a2035"}}></th>
                  {cols2.map(c=>(
                    <th key={c} style={{padding:"6px 10px",background:"rgba(43,108,176,0.3)",color:"#90cdf4",border:"1px solid #1a2035",whiteSpace:"nowrap"}}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r}>
                    <td style={{padding:"6px 10px",fontWeight:600,color:"#a0aec0",border:"1px solid #1a2035",background:"rgba(43,108,176,0.15)",whiteSpace:"nowrap"}}>{r}</td>
                    {cols2.map(c=>{
                      const val=valMap[`${r}_${c}`]||0;
                      const intensity=val/maxV;
                      return(
                        <td key={c} style={{padding:"6px 10px",textAlign:"center",color:"white",border:"1px solid #1a2035",background:`rgba(37,99,235,${0.1+intensity*0.8})`}}>
                          {fmt(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

        // ── DEFAULT: BAR / GROUPED BAR ──────────────────────
    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke={gridC}/>
          <XAxis dataKey={xCol} tick={{fill:"#cbd5e1",fontSize:fsz-1}}
            angle={data.length>6?-30:0}
            textAnchor={data.length>6?"end":"middle"}
            height={data.length>6?55:30}/>
          <YAxis tickFormatter={fmt} tick={{fill:"#cbd5e1",fontSize:fsz-1}}/>
          <Tooltip {...TT} formatter={(v,n)=>[fmt(v),n]} cursor={{ fill: 'transparent' }}/>
          {showLg && <Legend wrapperStyle={{color:"#a0aec0",fontSize:`${fsz-1}px`,paddingTop:8}}/>}
          {numCols.map((nc,i) => (
            <Bar key={nc} dataKey={nc}
              fill={COLORS[i%COLORS.length]} 
              radius={[3,3,0,0]}
              activeBar={false}>
              {showL && <LabelList dataKey={nc} position={labelPos === "inside" ? "inside" : "top"} formatter={fmt}
                style={{fill:"#e2e8f0",fontSize:`${fsz-2}px`,fontWeight:600}}/>}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div>
      {/* Chart title */}
      <div style={{fontSize:(settings?.titleSize||14),fontWeight:700,color:"#e2e8f0",marginBottom:12}}>
        {title}
      </div>

      {/* Chart */}
      <div style={{background:"#0f172a",borderRadius:10,padding:"16px 12px",border:"1px solid #334155",marginBottom:16}}>
        {renderChart()}
      </div>

      {/* Key Metrics — same as Streamlit */}
      {numCols.length > 0 && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:600,color:"#90cdf4",marginBottom:10}}>
            📌 Key Metrics
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {numCols.slice(0,4).map(nc => {
              const vals = data.map(r => Number(r[nc]) || 0);
              const sum  = vals.reduce((a,b)=>a+b,0);
              const avg  = vals.length ? sum/vals.length : 0;
              return (
                <div key={nc} style={{flex:1,minWidth:120,background:"rgba(255,255,255,0.04)",border:"1px solid #1a2035",borderRadius:8,padding:12}}>
                  <div style={{fontSize:10,color:"#718096",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                    {nc.replace(/_/g," ")}
                  </div>
                  <div style={{fontSize:"1.3rem",fontWeight:700,color:"white"}}>{fmt(sum)}</div>
                  <div style={{fontSize:10,color:"#4a5568",marginTop:2}}>avg {fmt(avg)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Download buttons */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button onClick={handleDownloadExcel} disabled={!!downloading}
          style={{padding:"8px 16px",background:"rgba(255,255,255,0.05)",border:"1px solid #1a2035",borderRadius:8,color:"#a0aec0",fontSize:12,cursor:"pointer"}}>
          {downloading==="excel"?"⏳ Building...":"📊 Download Excel"}
        </button>
        <button onClick={handleDownloadPdf} disabled={!!downloading}
          style={{padding:"8px 16px",background:"rgba(255,255,255,0.05)",border:"1px solid #1a2035",borderRadius:8,color:"#a0aec0",fontSize:12,cursor:"pointer"}}>
          {downloading==="pdf"?"⏳ Building...":"📄 Download PDF"}
        </button>
      </div>

      {/* Summary + Follow-ups */}
      <SummaryBlock sd={summary_data} onQuestion={onQuestion}/>
    </div>
  );
}

// ── Summary + Follow-up questions block ────────────────
function SummaryBlock({ sd, onQuestion }) {
  if (!sd?.summary) return null;
  return (
    <div>
      {/* Summary */}
      <div style={{background:"linear-gradient(135deg,rgba(13,26,58,0.9),rgba(26,16,64,0.8))",border:"1px solid #2b4c7e",borderLeft:"4px solid #2b6cb0",borderRadius:10,padding:"14px 18px",marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:"#63b3ed",marginBottom:8}}>📊 Summary</div>
        <ul style={{margin:0,paddingLeft:18,lineHeight:1.8,fontSize:13,color:"#a0aec0"}}>
          {(sd.summary||"").split('.').filter(s=>s.trim()).map((s,i)=>(
            <li key={i} style={{marginBottom:4}}>{s.trim()}.</li>
          ))}
        </ul>
      </div>

      {/* Follow-up questions — same as Streamlit */}
      {sd.followup_questions?.length > 0 && (
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:10}}>
            🔍 Follow-Up Questions
          </div>
          {sd.followup_questions.map((fq,i) => (
            <button key={i} onClick={() => onQuestion(fq)}
              style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid #1a2035",borderRadius:8,color:"#a0aec0",fontSize:13,cursor:"pointer",textAlign:"left",marginBottom:6,transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(43,108,176,0.2)";e.currentTarget.style.borderColor="#2b6cb0";e.currentTarget.style.color="#90cdf4";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="#1a2035";e.currentTarget.style.color="#a0aec0";}}>
              <div style={{background:"#2b6cb0",color:"white",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>
                {i+1}
              </div>
              💬 {fq}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Data table with util colour coding ─────────────────
function DataTable({ data, columns, numCols }) {
  const UTIL = ['UTIL','PCT','PERCENT','RATE'];
  const uCols = (columns||[]).filter(c =>
    UTIL.some(k => c.toUpperCase().includes(k)));
  const getBg = (col, val) => {
    if (!uCols.includes(col)) return "transparent";
    const n = Number(val);
    if (n > 100) return "rgba(197,48,48,0.25)";
    if (n < 70)  return "rgba(214,158,46,0.25)";
    return              "rgba(47,133,90,0.25)";
  };
  return (
    <div style={{overflowX:"auto",maxHeight:400,overflowY:"auto",marginBottom:16}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead style={{position:"sticky",top:0,zIndex:1}}>
          <tr>
            {(columns||[]).map(c=>(
              <th key={c} style={{padding:"8px 12px",textAlign:"left",background:"rgba(43,108,176,0.4)",color:"#90cdf4",fontWeight:600,borderBottom:"1px solid #2b4c7e",whiteSpace:"nowrap"}}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data||[]).map((row,i)=>(
            <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.02)":"transparent"}}>
              {(columns||[]).map(c=>(
                <td key={c} style={{padding:"7px 12px",color:"#a0aec0",borderBottom:"1px solid #1a2035",background:getBg(c,row[c]),whiteSpace:"nowrap"}}>
                  {typeof row[c]==="number" ? fmt(row[c]) : String(row[c]??"")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}