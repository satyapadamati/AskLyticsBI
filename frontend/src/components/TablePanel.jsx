export default function TablePanel({result}){
  const {data,columns}=result;
  const UTIL=['UTIL','PCT','PERCENT','RATE'];
  const uCols=columns?.filter(c=>UTIL.some(k=>c.toUpperCase().includes(k)))||[];
  const getBg=(col,val)=>{
    if(!uCols.includes(col))return "transparent";
    const n=Number(val);
    if(n>100)return"rgba(197,48,48,0.2)";
    if(n<70) return"rgba(214,158,46,0.2)";
    return         "rgba(47,133,90,0.2)";
  };
  const fmt=(v)=>{
    const n=Number(v);
    if(isNaN(n))return String(v??"");
    if(Math.abs(n)>=1e6)return`${(n/1e6).toFixed(1)}M`;
    if(Math.abs(n)>=1e3)return`${(n/1e3).toFixed(1)}K`;
    return Number.isInteger(n)?n:n.toFixed(2);
  };
  return(
    <div style={{overflowX:"auto",maxHeight:"500px",overflowY:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
        <thead style={{position:"sticky",top:0,zIndex:1}}>
          <tr>{columns?.map(c=>(
            <th key={c} style={{padding:"8px 12px",textAlign:"left",
              background:"rgba(43,108,176,0.4)",color:"#90cdf4",
              fontWeight:600,borderBottom:"1px solid #2b4c7e",
              whiteSpace:"nowrap"}}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>{data?.map((row,i)=>(
          <tr key={i} style={{background:i%2===0
            ?"rgba(255,255,255,0.02)":"transparent"}}>
            {columns?.map(c=>(
              <td key={c} style={{padding:"7px 12px",color:"#a0aec0",
                borderBottom:"1px solid #1a2035",
                background:getBg(c,row[c]),whiteSpace:"nowrap"}}>
                {typeof row[c]==="number"?fmt(row[c]):String(row[c]??"")}
              </td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}