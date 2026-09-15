import { useState } from "react";
import ChartPanel  from "./ChartPanel";
import TablePanel  from "./TablePanel";
import SqlPanel    from "./SqlPanel";
import WorkflowPanel from "./WorkflowPanel";

const TABS=[
  {id:"visual",   label:"📈 Visual"},
  {id:"table",    label:"📋 Table"},
  {id:"sql",      label:"🔍 SQL"},
  {id:"workflow", label:"🤖 AI Workflow"},
];

export default function ResultTabs({result,activeQ,onQuestion,settings}){
  const [tab,setTab]=useState("visual");

  const tabBtn=(t)=>({
    padding:"8px 16px",background:"transparent",border:"none",
    borderBottom:tab===t.id?"2px solid #2b6cb0":"2px solid transparent",
    color:tab===t.id?"#90cdf4":"#718096",
    fontSize:"13px",cursor:"pointer",fontWeight:tab===t.id?600:400,
    transition:"all 0.15s",whiteSpace:"nowrap",
  });

  return (
    <div style={{
      background:"rgba(255,255,255,0.02)",
      border:"1px solid #1a2035",borderRadius:"12px",overflow:"hidden"
    }}>
      {/* Success bar */}
      <div style={{
        padding:"8px 16px",
        background:"rgba(47,133,90,0.1)",
        borderBottom:"1px solid #1a3a2a",
        color:"#68d391",fontSize:"12px",
      }}>
        ✅ {result.row_count} rows × {result.columns?.length} columns
      </div>

      {/* Tab bar */}
      <div style={{
        display:"flex",borderBottom:"1px solid #1a2035",
        overflowX:"auto",background:"rgba(13,17,23,0.6)",
      }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={tabBtn(t)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{padding:"20px"}}>
        {tab==="visual"  &&
          <ChartPanel result={result} activeQ={activeQ}
            onQuestion={onQuestion} settings={settings}/>}
        {tab==="table"   &&<TablePanel   result={result}/>}
        {tab==="sql"     &&<SqlPanel     result={result}/>}
        {tab==="workflow"&&
          <WorkflowPanel result={result} activeQ={activeQ}/>}
      </div>
    </div>
  );
}