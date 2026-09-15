const STEPS=[
  {n:1,color:"#2b6cb0",bg:"rgba(43,108,176,0.1)",
   border:"#2b6cb0",label:"User Question",key:"question"},
  {n:2,color:"#276749",bg:"rgba(39,103,73,0.1)",
   border:"#276749",label:"Synonym Resolution",key:"synonyms"},
  {n:3,color:"#975a16",bg:"rgba(151,90,22,0.1)",
   border:"#975a16",label:"Groq LLaMA → SQL Generated",key:"sql"},
  {n:4,color:"#553c9a",bg:"rgba(85,60,154,0.1)",
   border:"#553c9a",label:"PostgreSQL Execution",key:"postgres"},
  {n:5,color:"#9b2c2c",bg:"rgba(155,44,44,0.1)",
   border:"#9b2c2c",label:"AI Explanation",key:"explanation"},
];
export default function WorkflowPanel({result,activeQ}){
  const syns=result.synonyms_used||[];
  const vals={
    question  :activeQ,
    synonyms  :syns.length?syns.join(", "):"No synonyms — direct match",
    sql       :null,
    postgres :`✅ Query executed on PostgreSQL — returned ${result.row_count} rows × ${result.columns?.length} columns`,
    explanation:result.explanation||"Visual generated successfully.",
  };
  return(
    <div>
      <div style={{fontSize:"14px",fontWeight:600,color:"#e2e8f0",
                   marginBottom:"16px"}}>🤖 AI Workflow</div>
      {STEPS.map(step=>(
        <div key={step.n} style={{display:"flex",gap:"12px",
                                   marginBottom:"12px",alignItems:"flex-start"}}>
          <div style={{background:step.color,color:"white",
                       borderRadius:"50%",width:"26px",height:"26px",
                       display:"flex",alignItems:"center",
                       justifyContent:"center",fontSize:"11px",
                       fontWeight:700,flexShrink:0,marginTop:"2px"}}>
            {step.n}
          </div>
          <div style={{background:step.bg,borderLeft:`3px solid ${step.border}`,
                       padding:"10px 14px",borderRadius:"0 8px 8px 0",flex:1}}>
            <div style={{fontSize:"10px",fontWeight:700,color:step.color,
                         textTransform:"uppercase",marginBottom:"4px"}}>
              {step.label}
            </div>
            {step.key==="sql"
              ? <pre style={{margin:0,fontFamily:"'Fira Code',monospace",
                             fontSize:"11px",color:"#e2e8f0",
                             overflowX:"auto",whiteSpace:"pre-wrap"}}>
                  {result.sql||"No SQL generated"}
                </pre>
              : <div style={{fontSize:"13px",color:"#a0aec0",lineHeight:"1.6"}}>
                  {vals[step.key]}
                </div>
            }
          </div>
        </div>
      ))}
    </div>
  );
}