import { useState } from "react";
import {
  Home,MessageSquare,LayoutDashboard,Database,
  BookOpen,Bot,Bell,Grid,Settings,
  Snowflake,ChevronDown,ChevronUp,Zap,
  Eye,EyeOff,BarChart2
  ,LogOut
} from "lucide-react";

const NAV=[
  {id:"chat",      icon:MessageSquare,   label:"Chat"},
  {id:"dashboard", icon:LayoutDashboard, label:"Dashboards"},
];

const CHART_TYPES=[
  "Auto (AI decides)","Bar","Grouped Bar","Horizontal Bar",
  "Line","Area","Pie","Donut","Scatter",
  "Heatmap","Funnel","Waterfall","KPI Cards","Table Only"
];

export default function Sidebar({
  view,setView,quickQs,onQuestion,
  queryCount,tileCount,
  onClearHistory,onClearDashboard,
  user,onLogout,
  settings
}){
  const [fmtOpen,  setFmtOpen]  = useState(false);
  const [chartOpen,setChartOpen]= useState(true);
  const [lblOpen,  setLblOpen]  = useState(true);
  const [gridOpen, setGridOpen] = useState(false);

  const S = { // shared styles
    section:{padding:"0 12px",marginBottom:"4px"},
    btn:(active)=>({
      width:"100%",padding:"8px 12px",
      background:active?"rgba(184,243,74,0.13)":"transparent",
      border:"none",
      borderLeft:active?"3px solid #b8f34a":"3px solid transparent",
      color:active?"#d7ff8b":"#718096",
      fontSize:"13px",cursor:"pointer",
      display:"flex",alignItems:"center",gap:"10px",
      textAlign:"left",transition:"all 0.15s",
    }),
    input:{
      width:"100%",background:"rgba(255,255,255,0.06)",
      border:"1px solid #2d3748",borderRadius:"6px",
      padding:"5px 8px",color:"white",fontSize:"12px",
      outline:"none",
    },
    toggle:(on)=>({
      width:"36px",height:"20px",borderRadius:"10px",
      background:on?"#2b6cb0":"#2d3748",
      border:"none",cursor:"pointer",
      position:"relative",transition:"background 0.2s",
      flexShrink:0,
    }),
  };

  const Row=({label,children})=>(
    <div style={{display:"flex",justifyContent:"space-between",
                 alignItems:"center",padding:"4px 0",gap:"8px"}}>
      <span style={{fontSize:"11px",color:"#718096",flexShrink:0}}>
        {label}
      </span>
      {children}
    </div>
  );

  return (
    <div style={{
      width        : "220px",
      background   : "rgba(8, 12, 24, 0.85)",   /* semi-transparent */
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderRight  : "1px solid rgba(99,179,237,0.08)",
      display      : "flex",
      flexDirection: "column",
      flexShrink   : 0,
      overflowY    : "auto",
      zIndex       : 10,
    }}>

      {/* Logo */}
      <div style={{padding:"18px 16px 12px",
                   display:"flex",alignItems:"center",gap:"8px"}}>
        <Database size={22} color="#f47763"/>
        <span style={{fontSize:"13px",fontWeight:600,color:"#a0aec0"}}>
          PostgreSQL
        </span>
      </div>

      {/* New Chat */}
      <div style={{padding:"0 12px 12px"}}>
        <button
          onClick={()=>{setView("chat");}}
          style={{width:"100%",padding:"8px 12px",
                  background:"linear-gradient(135deg,#0b4544,#0f766e)",
                  border:"none",borderRadius:"8px",color:"white",
                  fontSize:"13px",fontWeight:600,cursor:"pointer",
                  display:"flex",alignItems:"center",
                  gap:"6px",justifyContent:"center"}}>
          + New Chat
        </button>
      </div>

      {/* Nav */}
      <nav style={{flex:0}}>
        {NAV.map(item=>(
          <button key={item.id}
            onClick={()=>setView(item.id)}
            style={S.btn(view===item.id)}>
            <item.icon size={15}/>
            {item.label}
            {item.badge&&(
              <span style={{fontSize:"9px",marginLeft:"auto",
                background:"rgba(99,179,237,0.2)",color:"#63b3ed",
                padding:"1px 5px",borderRadius:"4px"}}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={{borderTop:"1px solid #1a2035",margin:"8px 0"}}/>

      {/* Format Visual collapsible */}
      <button
        onClick={()=>setFmtOpen(o=>!o)}
        style={{...S.btn(false),padding:"8px 12px",
                justifyContent:"space-between"}}>
        <span style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <BarChart2 size={15}/>
          Format Visual
        </span>
        {fmtOpen?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
      </button>

      {fmtOpen&&(
        <div style={{padding:"0 12px 8px"}}>

          {/* Chart Settings */}
          <button onClick={()=>setChartOpen(o=>!o)}
            style={{width:"100%",background:"none",border:"none",
                    color:"#a0aec0",fontSize:"11px",fontWeight:600,
                    textAlign:"left",padding:"6px 0",cursor:"pointer",
                    display:"flex",justifyContent:"space-between"}}>
            📊 Chart Settings
            {chartOpen?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
          </button>
          {chartOpen&&(
            <div style={{paddingBottom:"8px"}}>
              <div style={{fontSize:"10px",color:"#718096",marginBottom:"3px"}}>
                Chart Type
              </div>
              <select
                value={settings.chartType}
                onChange={e=>settings.setChartType(e.target.value)}
                style={{...S.input,marginBottom:"6px"}}>
                {CHART_TYPES.map(t=>(
                  <option key={t} value={t}
                    style={{background:"#1a2035"}}>{t}
                  </option>
                ))}
              </select>
              <Row label={`Height: ${settings.chartHeight}px`}>
                <input type="range" min={250} max={800} step={25}
                  value={settings.chartHeight}
                  onChange={e=>settings.setChartHeight(+e.target.value)}
                  style={{width:"90px",accentColor:"#2b6cb0"}}/>
              </Row>
            </div>
          )}

          {/* Data Labels */}
          <button onClick={()=>setLblOpen(o=>!o)}
            style={{width:"100%",background:"none",border:"none",
                    color:"#a0aec0",fontSize:"11px",fontWeight:600,
                    textAlign:"left",padding:"6px 0",cursor:"pointer",
                    display:"flex",justifyContent:"space-between"}}>
            🏷️ Data Labels
            {lblOpen?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
          </button>
          {lblOpen&&(
            <div style={{paddingBottom:"8px"}}>
              <Row label="Show Labels">
                <button
                  onClick={()=>settings.setShowLabels(l=>!l)}
                  style={S.toggle(settings.showLabels)}>
                  <div style={{position:"absolute",top:"3px",
                    left:settings.showLabels?"18px":"3px",
                    width:"14px",height:"14px",borderRadius:"50%",
                    background:"white",transition:"left 0.2s"}}/>
                </button>
              </Row>
              {settings.showLabels&&(
                <div>
                  <div style={{fontSize:"10px",color:"#718096",
                               marginBottom:"3px",marginTop:"4px"}}>
                    Position
                  </div>
                  <select
                    value={settings.labelPos}
                    onChange={e=>settings.setLabelPos(e.target.value)}
                    style={S.input}>
                    {["outside","inside","auto"].map(p=>(
                      <option key={p} value={p}
                        style={{background:"#1a2035"}}>{p}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Text & Grid */}
          <button onClick={()=>setGridOpen(o=>!o)}
            style={{width:"100%",background:"none",border:"none",
                    color:"#a0aec0",fontSize:"11px",fontWeight:600,
                    textAlign:"left",padding:"6px 0",cursor:"pointer",
                    display:"flex",justifyContent:"space-between"}}>
            ✏️ Text & Grid
            {gridOpen?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
          </button>
          {gridOpen&&(
            <div style={{paddingBottom:"8px"}}>
              <Row label={`Label: ${settings.fontSize}px`}>
                <input type="range" min={8} max={20}
                  value={settings.fontSize}
                  onChange={e=>settings.setFontSize(+e.target.value)}
                  style={{width:"70px",accentColor:"#2b6cb0"}}/>
              </Row>
              <Row label={`Title: ${settings.titleSize}px`}>
                <input type="range" min={10} max={32}
                  value={settings.titleSize}
                  onChange={e=>settings.setTitleSize(+e.target.value)}
                  style={{width:"70px",accentColor:"#2b6cb0"}}/>
              </Row>
              <Row label="Gridlines">
                <button onClick={()=>settings.setShowGridlines(g=>!g)}
                  style={S.toggle(settings.showGridlines)}>
                  <div style={{position:"absolute",top:"3px",
                    left:settings.showGridlines?"18px":"3px",
                    width:"14px",height:"14px",borderRadius:"50%",
                    background:"white",transition:"left 0.2s"}}/>
                </button>
              </Row>
              <Row label="Legend">
                <button onClick={()=>settings.setShowLegend(l=>!l)}
                  style={S.toggle(settings.showLegend)}>
                  <div style={{position:"absolute",top:"3px",
                    left:settings.showLegend?"18px":"3px",
                    width:"14px",height:"14px",borderRadius:"50%",
                    background:"white",transition:"left 0.2s"}}/>
                </button>
              </Row>
            </div>
          )}
        </div>
      )}

      <div style={{borderTop:"1px solid #1a2035",margin:"4px 0"}}/>

      {/* Quick Questions */}
      <div style={S.label}>
        <Zap size={11} style={{display:"inline",marginRight:"4px"}}/>
        Quick Questions
      </div>
      <div style={{fontSize:"10px",color:"#4a5568",
                   padding:"0 12px 6px"}}>
        📌 Preset — click to generate
      </div>
      <div style={{padding:"0 8px"}}>
        {quickQs.map(q=>(
          <button key={q.label}
            onClick={()=>onQuestion(q.prompt)}
            style={{
              width:"100%",padding:"6px 8px",
              background:"rgba(255,255,255,0.03)",
              border:"1px solid #1a2035",
              borderRadius:"6px",color:"#718096",
              fontSize:"11px",cursor:"pointer",
              textAlign:"left",marginBottom:"4px",
              display:"flex",alignItems:"center",gap:"6px",
              transition:"all 0.15s",
            }}
            onMouseEnter={e=>{
              e.currentTarget.style.background="rgba(43,108,176,0.2)";
              e.currentTarget.style.color="#90cdf4";
            }}
            onMouseLeave={e=>{
              e.currentTarget.style.background="rgba(255,255,255,0.03)";
              e.currentTarget.style.color="#718096";
            }}>
            ▶ {q.label}
          </button>
        ))}
      </div>

      <div style={{borderTop:"1px solid #1a2035",margin:"8px 0"}}/>

      {/* Stats + Clear */}
      <div style={{padding:"0 12px 8px"}}>
        <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
          <div style={{flex:1,background:"rgba(255,255,255,0.04)",
                       borderRadius:"6px",padding:"8px",
                       textAlign:"center"}}>
            <div style={{fontSize:"16px",fontWeight:700,
                         color:"#90cdf4"}}>{queryCount}</div>
            <div style={{fontSize:"9px",color:"#718096"}}>Queries</div>
          </div>
          <div style={{flex:1,background:"rgba(255,255,255,0.04)",
                       borderRadius:"6px",padding:"8px",
                       textAlign:"center"}}>
            <div style={{fontSize:"16px",fontWeight:700,
                         color:"#90cdf4"}}>{tileCount}/12</div>
            <div style={{fontSize:"9px",color:"#718096"}}>Tiles</div>
          </div>
        </div>
        <button onClick={onClearHistory}
          style={{width:"100%",marginBottom:"4px",padding:"6px",
                  background:"rgba(255,255,255,0.04)",
                  border:"1px solid #1a2035",borderRadius:"6px",
                  color:"#718096",fontSize:"11px",cursor:"pointer"}}>
          🗑️ Clear History
        </button>
        <button onClick={onClearDashboard}
          style={{width:"100%",padding:"6px",
                  background:"rgba(255,255,255,0.04)",
                  border:"1px solid #1a2035",borderRadius:"6px",
                  color:"#718096",fontSize:"11px",cursor:"pointer"}}>
          🗑️ Clear Dashboard
        </button>
      </div>

      {/* User */}
      <div style={{marginTop:"auto",padding:"12px 16px",
                   borderTop:"1px solid #1a2035",
                   display:"flex",alignItems:"center",gap:"8px"}}>
        <div style={{width:"28px",height:"28px",borderRadius:"50%",
                     background:"linear-gradient(135deg,#0f766e,#f47763)",
                     display:"flex",alignItems:"center",
                     justifyContent:"center",fontSize:"11px",
                     fontWeight:700,color:"white",flexShrink:0}}>
          {(user?.username || "A").slice(0, 2).toUpperCase()}
        </div>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:"11px",fontWeight:600,color:"#e2e8f0"}}>
            {user?.username || "Account"}
          </div>
          <div style={{fontSize:"9px",color:"#718096"}}>
            ASKLYTICSBI USER
          </div>
        </div>
        <button onClick={onLogout} title="Log out" aria-label="Log out"
          style={{background:"transparent",border:"none",color:"#94a3b8",
                  cursor:"pointer",padding:"5px",display:"flex"}}>
          <LogOut size={15}/>
        </button>
      </div>
    </div>
  );
}