import { useState } from "react";
import { api } from "../api";

export default function SqlPanel({result}){
  const [edited,setEdited]=useState(result.sql||"");
  const [sqlResult,setSqlResult]=useState(null);
  const [running,setRunning]=useState(false);
  const [err,setErr]=useState(null);

  const runSql=async()=>{
    setRunning(true);setErr(null);
    try{
      const r=await api.runSql(edited);
      setSqlResult(r);
    }catch(e){setErr(e.detail||"SQL error");}
    finally{setRunning(false);}
  };

  return(
    <div>
      <pre style={{background:"rgba(0,0,0,0.4)",border:"1px solid #1a2035",
                   borderRadius:"8px",padding:"16px",color:"#90cdf4",
                   fontSize:"12px",fontFamily:"'Fira Code',monospace",
                   overflowX:"auto",marginBottom:"12px",lineHeight:"1.6"}}>
        {result.sql}
      </pre>
      <div style={{fontSize:"12px",color:"#718096",marginBottom:"6px"}}>
        ✏️ Modify SQL:
      </div>
      <textarea
        value={edited}
        onChange={e=>setEdited(e.target.value)}
        rows={6}
        style={{width:"100%",background:"rgba(0,0,0,0.3)",
                border:"1px solid #2b4c7e",borderRadius:"8px",
                padding:"12px",color:"#e2e8f0",fontSize:"12px",
                fontFamily:"'Fira Code',monospace",
                outline:"none",resize:"vertical",marginBottom:"8px"}}
      />
      <button onClick={runSql} disabled={running}
        style={{padding:"8px 16px",background:"#2b6cb0",border:"none",
                borderRadius:"8px",color:"white",fontSize:"12px",
                cursor:"pointer",marginBottom:"12px"}}>
        {running?"Running...":"▶️ Run Modified SQL"}
      </button>
      {err&&<p style={{color:"#fc8181",fontSize:"12px"}}>{err}</p>}
      {sqlResult&&(
        <div style={{overflowX:"auto"}}>
          <p style={{color:"#68d391",fontSize:"12px",marginBottom:"8px"}}>
            ✅ {sqlResult.row_count} rows
          </p>
          <table style={{width:"100%",borderCollapse:"collapse",
                         fontSize:"11px"}}>
            <thead><tr>{sqlResult.columns?.map(c=>(
              <th key={c} style={{padding:"6px 10px",
                background:"rgba(43,108,176,0.3)",
                color:"#90cdf4",borderBottom:"1px solid #2b4c7e",
                textAlign:"left"}}>{c}</th>
            ))}</tr></thead>
            <tbody>{sqlResult.data?.slice(0,50).map((row,i)=>(
              <tr key={i}>{sqlResult.columns?.map(c=>(
                <td key={c} style={{padding:"5px 10px",color:"#a0aec0",
                  borderBottom:"1px solid #1a2035"}}>
                  {String(row[c]??"")}
                </td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}