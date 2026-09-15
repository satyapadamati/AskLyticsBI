import { useState, useRef, useEffect } from "react";
import { Send }   from "lucide-react";
import ResultTabs from "./ResultTabs";

const CHIP_QUESTIONS = [
  {icon:"📊", label:"Total demand by function"},
  {icon:"⚡", label:"Demand vs capacity by function"},
  {icon:"📈", label:"Monthly demand trend"},
  {icon:"👥", label:"Top 5 roles by demand"},
];

export default function ChatView({
  result,loading,error,onQuestion,onAddToDashboard,
  settings,chatHistory,queryCount,activeQ
}){
  const [input,setInput]=useState("");
  const inputRef=useRef(null);

  const submit=(q)=>{
    const question=q||input.trim();
    if(!question)return;
    setInput(""); onQuestion(question);
  };

  const hasResult=result&&result.data?.length>0;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>

      {/* Header */}
      <div style={{
        padding:"18px 28px 14px",
        borderBottom:"1px solid #1a2035",
        display:"flex",alignItems:"center",
        justifyContent:"space-between",
        background:"rgba(6,10,22,0.85)",
        backdropFilter:"blur(12px)",
        WebkitBackdropFilter:"blur(12px)",
        flexShrink:0,
      }}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"20px",fontWeight:700,color:"white"}}>
              Gen BI Agent
            </span>
            <span style={{fontSize:"10px",
              background:"rgba(99,179,237,0.15)",
              color:"#63b3ed",padding:"2px 8px",
              borderRadius:"10px",border:"1px solid #2b4c7e"}}>
              Preview
            </span>
          </div>
          <div style={{fontSize:"12px",color:"#4a5568",marginTop:"3px"}}>
            Your AI-Powered Analytics Assistant
          </div>
        </div>
        {hasResult&&(
          <button onClick={onAddToDashboard}
            style={{padding:"8px 16px",
              background:"linear-gradient(135deg,#1a4a8a,#2b6cb0)",
              border:"none",borderRadius:"8px",color:"white",
              fontSize:"12px",fontWeight:600,cursor:"pointer"}}>
            📌 Add to Dashboard
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>

        {!hasResult&&!loading&&!error ? (
          /* Welcome screen — styled like reference image */
          <div style={{
            background:"linear-gradient(135deg,rgba(10,20,50,0.9) 0%,rgba(20,10,50,0.85) 60%,rgba(10,20,50,0.9) 100%)",
            backdropFilter:"blur(8px)",
            WebkitBackdropFilter:"blur(8px)",
            border:"1px solid rgba(99,179,237,0.12)",
            borderRadius:"16px",padding:"36px 32px 28px",
            marginBottom:"24px",
          }}>
            <div style={{fontSize:"22px",fontWeight:700,
                         color:"#63b3ed",marginBottom:"6px"}}>
              Hello Prathyusha! 👋
            </div>
            <div style={{fontSize:"17px",color:"white",
                         fontWeight:600,marginBottom:"24px"}}>
              What insights can I uncover for you today?
            </div>

            {/* Input box — styled like reference image */}
            <div style={{
              display:"flex",
              background:"rgba(255,255,255,0.04)",
              borderRadius:"12px",
              border:"1.5px solid #2b4c7e",
              padding:"12px 14px",gap:"10px",
              alignItems:"center",marginBottom:"16px",
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&submit()}
                placeholder="Ask anything about your data..."
                style={{flex:1,background:"transparent",border:"none",
                        outline:"none",color:"white",fontSize:"14px"}}
              />              
              <button onClick={()=>submit()}
                disabled={loading||!input.trim()}
                style={{
                  background:input.trim()?"#2b6cb0":"#1a2a4a",
                  border:"none",borderRadius:"8px",
                  width:"38px",height:"38px",display:"flex",
                  alignItems:"center",justifyContent:"center",
                  cursor:input.trim()?"pointer":"not-allowed",
                  color:"white",transition:"background 0.2s",flexShrink:0
                }}>
                <Send size={16}/>
              </button>
            </div>

            {/* Quick chips — styled like reference image */}
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {CHIP_QUESTIONS.map(q=>(
                <button key={q.label}
                  onClick={()=>submit(q.label)}
                  style={{display:"flex",alignItems:"center",
                           gap:"6px",padding:"7px 14px",
                           background:"rgba(255,255,255,0.05)",
                           border:"1px solid #1a2a4a",
                           borderRadius:"8px",color:"#a0aec0",
                           fontSize:"12px",cursor:"pointer",
                           transition:"all 0.15s"}}
                  onMouseEnter={e=>{
                    e.currentTarget.style.background="rgba(43,108,176,0.2)";
                    e.currentTarget.style.color="#90cdf4";
                    e.currentTarget.style.borderColor="#2b6cb0";
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.background="rgba(255,255,255,0.05)";
                    e.currentTarget.style.color="#a0aec0";
                    e.currentTarget.style.borderColor="#1a2a4a";
                  }}>
                  <span>{q.icon}</span>{q.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Loading */}
        {loading&&(
          <div style={{display:"flex",alignItems:"center",gap:"12px",
                       padding:"20px",
                       background:"rgba(255,255,255,0.03)",
                       borderRadius:"12px",border:"1px solid #1a2035"}}>
            <div style={{width:"20px",height:"20px",borderRadius:"50%",
                         border:"2px solid #2b6cb0",
                         borderTop:"2px solid transparent",
                         animation:"spin 0.8s linear infinite"}}/>
            <span style={{color:"#90cdf4",fontSize:"13px"}}>
              🧠 Generating SQL and querying PostgreSQL...
            </span>
          </div>
        )}

        {/* Error */}
        {error&&(
          <div style={{background:"rgba(197,48,48,0.1)",
                       border:"1px solid #c53030",
                       borderLeft:"4px solid #fc8181",
                       borderRadius:"8px",padding:"14px 16px",
                       color:"#fc8181",fontSize:"13px"}}>
            ❌ <strong>Error:</strong> {error}
          </div>
        )}

        {/* Result tabs */}
        {hasResult&&!loading&&(
          <ResultTabs
            result={result}
            activeQ={activeQ}
            onQuestion={onQuestion}
            settings={settings}
          />
        )}
      </div>

      {/* Bottom input (when result shown) */}
      {hasResult&&(
        <div style={{padding:"14px 28px",
                     borderTop:"1px solid #1a2035",
                     display:"flex",gap:"10px",flexShrink:0,
                     background:"rgba(13,17,23,0.9)"}}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="Ask a follow-up question..."
            style={{flex:1,background:"rgba(255,255,255,0.05)",
                    border:"1px solid #2b4c7e",borderRadius:"8px",
                    padding:"10px 14px",color:"white",
                    fontSize:"13px",outline:"none"}}
          />
          <button onClick={()=>submit()}
            disabled={loading||!input.trim()}
            style={{padding:"10px 18px",
                    background:"#2b6cb0",border:"none",
                    borderRadius:"8px",color:"white",
                    cursor:"pointer",fontSize:"13px"}}>
            <Send size={15}/>
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin{
          from{transform:rotate(0deg);}
          to{transform:rotate(360deg);}
        }
        input::placeholder {
          color: #90cdf4 !important;
          opacity: 1 !important;
        }
        input::-webkit-input-placeholder {
          color: #90cdf4 !important;
          opacity: 1 !important;
        }
        input::-moz-placeholder {
          color: #90cdf4 !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}