// MainPanel.jsx
import ChatView      from "./ChatView";
import DashboardView from "./DashboardView";

export default function MainPanel(props) {
  const { view } = props;
  return (
    <div style={{
      flex           : 1,
      display        : "flex",
      flexDirection  : "column",
      overflow       : "hidden",
      // Semi-transparent so background mountains show through
      background     : "rgba(8,26,34,0.92)",
      backdropFilter : "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      // NO position/zIndex here — parent (App.jsx layer 2) handles it
    }}>
      {view === "dashboard"
        ? <DashboardView
            dashItems   ={props.dashItems}
            setDashItems={props.setDashItems}
            kpis        ={props.kpis}
            onDeleteTile={props.onDeleteTile}
            onQuestion  ={props.onQuestion}
            settings    ={props.settings}
          />
        : <ChatView
            result          ={props.result}
            loading         ={props.loading}
            error           ={props.error}
            onQuestion      ={props.onQuestion}
            onAddToDashboard={props.onAddToDashboard}
            settings        ={props.settings}
            chatHistory     ={props.chatHistory}
            queryCount      ={props.queryCount}
            activeQ         ={props.activeQ}
            user            ={props.user}
          />
      }
    </div>
  );
}
