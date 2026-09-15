import { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import Sidebar   from "./components/Sidebar";
import MainPanel from "./components/MainPanel";
import "./index.css";

export default function App() {
  // ── View state ─────────────────────────────────────
  const [view, setView] = useState("chat");

  // ── Query state ────────────────────────────────────
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [queryCount,  setQueryCount]  = useState(0);
  const [activeQ,     setActiveQ]     = useState("");

  // ── Dashboard state ────────────────────────────────
  const [dashItems, setDashItems] = useState([]);

  // ── Sidebar data ───────────────────────────────────
  const [quickQs, setQuickQs] = useState([]);
  const [kpis,    setKpis]    = useState(null);

  // ── Chart settings (same as Streamlit sidebar) ─────
  const [chartType,     setChartType]     = useState("Auto (AI decides)");
  const [showLabels,    setShowLabels]    = useState(true);
  const [labelPos,      setLabelPos]      = useState("outside");
  const [showGridlines, setShowGridlines] = useState(true);
  const [showLegend,    setShowLegend]    = useState(true);
  const [showZeroLine,  setShowZeroLine]  = useState(false);
  const [fontSize,      setFontSize]      = useState(12);
  const [titleSize,     setTitleSize]     = useState(14);
  const [chartHeight,   setChartHeight]   = useState(420);

  // ── Load on startup ────────────────────────────────
  useEffect(() => {
    api.quickQuestions()
       .then(r => setQuickQs(r.questions || []))
       .catch(() => {});
    api.kpis()
       .then(d => setKpis({
         total_demand    : Number(d.total_demand     || 0),
         total_capacity  : Number(d.total_capacity   || 0),
         total_gap       : Number(d.total_gap        || 0),
         avg_utilization : Number(d.avg_utilization  || 0),
         at_risk_projects: Number(d.at_risk_projects || 0),
       }))
       .catch(() => {});
  }, []);

  // ── Run AI query ───────────────────────────────────
  const runQuery = useCallback(async (question) => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setActiveQ(question);
    try {
      const res = await api.query(
        question, chatHistory,
        chartType, showLabels, labelPos);
      setResult(res);
      setChatHistory(h => [
        ...h,
        { role:"user",      content: question },
        { role:"assistant", content: res.explanation || "" },
      ]);
      setQueryCount(c => c + 1);
      // Refresh KPIs after query
      api.kpis().then(d => setKpis({
        total_demand    : Number(d.total_demand     || 0),
        total_capacity  : Number(d.total_capacity   || 0),
        total_gap       : Number(d.total_gap        || 0),
        avg_utilization : Number(d.avg_utilization  || 0),
        at_risk_projects: Number(d.at_risk_projects || 0),
      })).catch(()=>{});
    } catch (e) {
      setError(e.detail || e.message || "Query failed");
    } finally {
      setLoading(false);
    }
  }, [chatHistory, chartType, showLabels, labelPos]);

  // ── Add current result to dashboard ───────────────
  const addToDashboard = useCallback(() => {
    if (!result || !result.data || result.data.length === 0) return;
    if (dashItems.length >= 12) {
      alert("Dashboard full — max 12 tiles"); return;
    }
    const title = result.chart_config?.title
      || activeQ.slice(0,55).replace(/\?$/,"").trim()
      || ("Visual " + (dashItems.length + 1));
    const ctype = result.chart_config?.chart_type || "bar";
    setDashItems(d => [...d, {
      tile_id          : "tid_" + Date.now(),
      question         : activeQ,
      data             : result.data,
      originalData     : result.data,
      cfg              : result.chart_config || {},
      sql              : result.sql || "",
      title,
      fixed_ctype      : ctype,
      saved_show_labels: showLabels,
      saved_label_pos  : labelPos,
      columns          : result.columns     || [],
      num_columns      : result.num_columns  || [],
      text_columns     : result.text_columns || [],
    }]);
  }, [result, activeQ, dashItems.length, showLabels, labelPos]);

  // ── Delete a dashboard tile ────────────────────────
  const deleteTile = useCallback(tileId =>
    setDashItems(d => d.filter(t => t.tile_id !== tileId)),
  []);

  // ── Settings object passed to all components ───────
  const settings = {
    chartType,    setChartType,
    showLabels,   setShowLabels,
    labelPos,     setLabelPos,
    showGridlines,setShowGridlines,
    showLegend,   setShowLegend,
    showZeroLine, setShowZeroLine,
    fontSize,     setFontSize,
    titleSize,    setTitleSize,
    chartHeight,  setChartHeight,
  };

  return (
    <div style={{
      display   : "flex",
      width     : "100vw",
      height    : "100vh",
      overflow  : "hidden",
      background: "#080c18",
      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
      color     : "#e2e8f0",
    }}>
      <Sidebar
        view             ={view}
        setView          ={setView}
        quickQs          ={quickQs}
        onQuestion       ={runQuery}
        queryCount       ={queryCount}
        tileCount        ={dashItems.length}
        onClearHistory   ={() => {
          setChatHistory([]);
          setResult(null);
          setQueryCount(0);
          setActiveQ("");
        }}
        onClearDashboard ={() => setDashItems([])}
        settings         ={settings}
      />
      <MainPanel
        view             ={view}
        result           ={result}
        loading          ={loading}
        error            ={error}
        dashItems        ={dashItems}
        setDashItems     ={setDashItems}
        kpis             ={kpis}
        activeQ          ={activeQ}
        onQuestion       ={runQuery}
        onAddToDashboard ={addToDashboard}
        onDeleteTile     ={deleteTile}
        settings         ={settings}
        chatHistory      ={chatHistory}
        queryCount       ={queryCount}
      />
    </div>
  );
}