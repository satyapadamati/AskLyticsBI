# =============================================================
# backend/main.py — Gen BI Agent FastAPI Backend
# Complete file with all endpoints
# =============================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any
import pandas as pd
import io, os, json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from ai_engine import ask_ai
from pg_connector import test_connection, run_query, get_table_schema
from dotenv import load_dotenv
load_dotenv()

# ──────────────────────────────────────────────────────────
# APP SETUP
# ──────────────────────────────────────────────────────────
app = FastAPI(title="Gen BI Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCH  = os.getenv("PG_SCHEMA", "final")
TBL  = os.getenv("PG_TABLE",  "company_x_final_table")
FTBL = f"{SCH}.{TBL}"

# ──────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────
CHART_TYPES = [
    "Auto (AI decides)", "Bar", "Grouped Bar", "Horizontal Bar",
    "Line", "Area", "Pie", "Donut", "Scatter",
    "Heatmap", "Funnel", "Waterfall", "KPI Cards", "Table Only",
]

QUICK_QUESTIONS = {
    "Total demand by function":
        "Show total demand by function as a bar chart",
    "Demand vs capacity by function":
        "Show demand vs capacity by function as grouped bar",
    "Function with highest demand gap":
        "Which function has the highest demand gap",
    "Top 5 roles by demand":
        "Show top 5 roles with highest total demand",
    "Monthly demand trend":
        "Show monthly demand trend by date as line chart",
    "Demand vs capacity by role":
        "Compare total demand and capacity by role as grouped bar",
    "Demand gap by subfunction":
        "Show demand gap by subfunction",
    "Roles distribution by portfolio":
        "Show distribution of roles by portfolio as bar chart",
}

MCOLORS = [
    '#2563eb', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
]

# ──────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────
def fmt_num(val):
    try:
        v = float(val)
        if abs(v) >= 1_000_000: return f"{v/1_000_000:.1f}M"
        if abs(v) >= 1_000:     return f"{v/1_000:.1f}K"
        return f"{v:,.0f}"
    except:
        return str(val)


def df_to_records(df):
    """Convert DataFrame to JSON-safe list of dicts."""
    if df is None or df.empty:
        return []
    df2 = df.copy()
    # Convert datetime columns to string
    for c in df2.select_dtypes(
            include=['datetime64', 'datetime64[ns]']).columns:
        df2[c] = df2[c].astype(str)
    # Convert any remaining non-serialisable types
    for c in df2.columns:
        try:
            df2[c].to_json()
        except Exception:
            df2[c] = df2[c].astype(str)
    return df2.to_dict(orient="records")


def coerce_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Convert numeric-like object columns to numeric so chart metadata is accurate."""
    if df is None or df.empty:
        return df

    df2 = df.copy()
    for c in df2.columns:
        series = df2[c]
        if pd.api.types.is_numeric_dtype(series):
            continue

        converted = pd.to_numeric(series, errors='coerce')
        non_null_original = series.notna().sum()
        non_null_converted = converted.notna().sum()

        # Treat a column as numeric only when all non-null values are numeric-like.
        if non_null_original > 0 and non_null_original == non_null_converted:
            df2[c] = converted

    return df2


# ──────────────────────────────────────────────────────────
# MATPLOTLIB CHART RENDERER
# Used for PDF and Excel exports — no Chrome/kaleido needed
# ──────────────────────────────────────────────────────────
def mpl_chart_to_png_bytes(data, chart_type, title="",
                            show_labels=True,
                            fig_w=10.0, fig_h=4.5, dpi=150):
    """
    Render chart to PNG bytes using matplotlib.
    Supports: bar, grouped_bar, horizontal_bar, line, area,
              pie, donut, scatter, waterfall, and fallback bar.
    """
    try:
        if not data:
            return None

        df_i = pd.DataFrame(data)
        if df_i.empty:
            return None

        text_cols = df_i.select_dtypes(
            exclude='number').columns.tolist()
        num_cols  = df_i.select_dtypes(
            include='number').columns.tolist()

        if not num_cols:
            return None

        ctype = str(chart_type).lower().replace(" ", "_")

        fig_obj = plt.figure(figsize=(fig_w, fig_h),
                             facecolor='white')
        ax = fig_obj.add_subplot(111)
        ax.set_facecolor('white')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#d1d9e0')
        ax.spines['bottom'].set_color('#d1d9e0')
        ax.tick_params(colors='#333333', labelsize=8)
        ax.yaxis.grid(True, color='#e8edf2',
                      linewidth=0.7, zorder=0)
        ax.set_axisbelow(True)

        x_labels = (df_i[text_cols[0]].astype(str).tolist()
                    if text_cols
                    else [str(i) for i in range(len(df_i))])
        x_pos = np.arange(len(x_labels))

        # ── BAR ──────────────────────────────────────────
        if ctype == "bar":
            y    = df_i[num_cols[0]].tolist()
            bars = ax.bar(x_pos, y, color=MCOLORS[0],
                          width=0.55, zorder=3)
            ax.set_xticks(x_pos)
            ax.set_xticklabels(
                x_labels,
                rotation=30 if len(x_labels) > 6 else 0,
                ha='right', fontsize=8)
            if show_labels:
                for b in bars:
                    h = b.get_height()
                    ax.text(b.get_x() + b.get_width()/2,
                            h + max(abs(h)*0.02, 0.5),
                            fmt_num(h),
                            ha='center', va='bottom',
                            fontsize=9, fontweight='bold',
                            color='#111111')

        # ── GROUPED BAR ───────────────────────────────────
        elif ctype == "grouped_bar":
            n_groups = len(num_cols)
            w = 0.8 / n_groups
            for gi, nc in enumerate(num_cols):
                y   = df_i[nc].tolist()
                pos = x_pos - 0.4 + gi*w + w/2
                bars = ax.bar(
                    pos, y, w*0.9,
                    color=MCOLORS[gi % len(MCOLORS)],
                    label=nc.replace("_", " ").title(),
                    zorder=3)
                if show_labels:
                    for b in bars:
                        h  = b.get_height()
                        yp = (h + max(abs(h)*0.02, 0.5)
                              if h >= 0
                              else h - max(abs(h)*0.02, 0.5))
                        va = 'bottom' if h >= 0 else 'top'
                        ax.text(b.get_x() + b.get_width()/2,
                                yp, fmt_num(h),
                                ha='center', va=va,
                                fontsize=8, fontweight='bold',
                                color='#111111')
            ax.set_xticks(x_pos)
            ax.set_xticklabels(
                x_labels,
                rotation=30 if len(x_labels) > 5 else 0,
                ha='right', fontsize=8)
            ax.legend(fontsize=8, loc='upper right',
                      framealpha=0.9)

        # ── HORIZONTAL BAR ────────────────────────────────
        elif ctype == "horizontal_bar":
            y    = df_i[num_cols[0]].tolist()
            bars = ax.barh(np.arange(len(x_labels)), y,
                           color=MCOLORS[0],
                           height=0.55, zorder=3)
            ax.set_yticks(np.arange(len(x_labels)))
            ax.set_yticklabels(x_labels, fontsize=8)
            ax.xaxis.grid(True, color='#e8edf2',
                          linewidth=0.7, zorder=0)
            ax.yaxis.grid(False)
            if show_labels:
                for b in bars:
                    w2 = b.get_width()
                    ax.text(w2 + max(abs(w2)*0.02, 0.5),
                            b.get_y() + b.get_height()/2,
                            fmt_num(w2),
                            ha='left', va='center',
                            fontsize=9, fontweight='bold',
                            color='#111111')

        # ── LINE / AREA ───────────────────────────────────
        elif ctype in ["line", "area"]:
            y = df_i[num_cols[0]].tolist()
            if ctype == "area":
                ax.fill_between(x_pos, y, alpha=0.25,
                                color=MCOLORS[0])
            ax.plot(x_pos, y, color=MCOLORS[0],
                    linewidth=2.2, marker='o',
                    markersize=5, zorder=3)
            if len(num_cols) > 1:
                for gi, nc in enumerate(num_cols[1:], 1):
                    y2 = df_i[nc].tolist()
                    ax.plot(x_pos, y2,
                            color=MCOLORS[gi % len(MCOLORS)],
                            linewidth=2.2, marker='o',
                            markersize=5, zorder=3,
                            label=nc.replace("_"," ").title())
                ax.legend(fontsize=8, framealpha=0.9)
            ax.set_xticks(x_pos)
            ax.set_xticklabels(
                x_labels,
                rotation=30 if len(x_labels) > 6 else 0,
                ha='right', fontsize=8)
            if show_labels:
                for xi, yi in zip(x_pos, y):
                    ax.text(xi, yi + max(abs(yi)*0.03, 0.5),
                            fmt_num(yi),
                            ha='center', va='bottom',
                            fontsize=8, fontweight='bold',
                            color='#111111')

        # ── PIE / DONUT ───────────────────────────────────
        elif ctype in ["pie", "donut"]:
            sizes  = df_i[num_cols[0]].tolist()
            colors = MCOLORS[:len(sizes)]
            wp     = {'linewidth': 0.8, 'edgecolor': 'white'}
            if ctype == "donut":
                _, texts, ats = ax.pie(
                    sizes, labels=x_labels,
                    colors=colors, autopct='%1.1f%%',
                    wedgeprops=dict(**wp, width=0.55),
                    pctdistance=0.75, startangle=90)
                ax.text(0, 0, fmt_num(sum(sizes)),
                        ha='center', va='center',
                        fontsize=11, fontweight='bold',
                        color='#0f172a')
            else:
                _, texts, ats = ax.pie(
                    sizes, labels=x_labels,
                    colors=colors, autopct='%1.1f%%',
                    wedgeprops=wp, startangle=90)
            for t in ats:
                t.set_fontsize(8)
                t.set_color('#111111')
            for t in texts:
                t.set_fontsize(8)

        # ── SCATTER ───────────────────────────────────────
        elif ctype == "scatter":
            xc = df_i[num_cols[0]].tolist()
            yc = (df_i[num_cols[1]].tolist()
                  if len(num_cols) > 1 else xc)
            ax.scatter(xc, yc, color=MCOLORS[0],
                       s=50, zorder=3, alpha=0.8)

        # ── WATERFALL ─────────────────────────────────────
        elif ctype == "waterfall":
            y       = df_i[num_cols[0]].tolist()
            running = 0
            for wi, val in enumerate(y):
                color = MCOLORS[0] if val >= 0 else '#ef4444'
                ax.bar(wi, val, bottom=running,
                       color=color, width=0.55, zorder=3)
                if show_labels:
                    ax.text(wi,
                            running + val
                            + max(abs(val)*0.02, 0.5),
                            fmt_num(val),
                            ha='center', va='bottom',
                            fontsize=8, fontweight='bold',
                            color='#111111')
                running += val
            ax.set_xticks(x_pos)
            ax.set_xticklabels(
                x_labels,
                rotation=30 if len(x_labels) > 6 else 0,
                ha='right', fontsize=8)

        # ── FUNNEL ────────────────────────────────────────
        elif ctype == "funnel":
            y = df_i[num_cols[0]].tolist()
            bars = ax.barh(np.arange(len(x_labels)), y,
                           color=MCOLORS[:len(y)],
                           height=0.55, zorder=3)
            ax.set_yticks(np.arange(len(x_labels)))
            ax.set_yticklabels(x_labels, fontsize=8)
            ax.invert_yaxis()
            if show_labels:
                for b in bars:
                    w2 = b.get_width()
                    ax.text(w2/2,
                            b.get_y() + b.get_height()/2,
                            fmt_num(w2),
                            ha='center', va='center',
                            fontsize=9, fontweight='bold',
                            color='white')

        # ── HEATMAP ───────────────────────────────────────
        elif ctype == "heatmap":
            if len(text_cols) >= 2 and num_cols:
                pivot = df_i.pivot_table(
                    index   =text_cols[0],
                    columns =text_cols[1],
                    values  =num_cols[0],
                    aggfunc ='sum').fillna(0)
                im = ax.imshow(
                    pivot.values,
                    cmap='Blues', aspect='auto')
                ax.set_xticks(range(len(pivot.columns)))
                ax.set_xticklabels(
                    pivot.columns, rotation=45,
                    ha='right', fontsize=8)
                ax.set_yticks(range(len(pivot.index)))
                ax.set_yticklabels(pivot.index, fontsize=8)
                fig_obj.colorbar(im, ax=ax)
            else:
                y = df_i[num_cols[0]].tolist()
                ax.bar(x_pos, y, color=MCOLORS[0],
                       width=0.55, zorder=3)
                ax.set_xticks(x_pos)
                ax.set_xticklabels(x_labels,
                    rotation=30, ha='right', fontsize=8)

        # ── KPI CARDS (table layout in PDF) ───────────────
        elif ctype == "kpi_cards":
            ax.axis('off')
            if text_cols and num_cols:
                for ri, (_, row) in enumerate(
                        df_i.head(6).iterrows()):
                    ax.text(0.05, 1 - ri*0.18,
                            str(row[text_cols[0]]),
                            transform=ax.transAxes,
                            fontsize=10, color='#243a5e',
                            fontweight='bold')
                    ax.text(0.55, 1 - ri*0.18,
                            fmt_num(row[num_cols[0]]),
                            transform=ax.transAxes,
                            fontsize=12, color='#2563eb',
                            fontweight='bold')

        # ── FALLBACK: plain bar ───────────────────────────
        else:
            y = df_i[num_cols[0]].tolist()
            ax.bar(x_pos, y, color=MCOLORS[0],
                   width=0.55, zorder=3)
            ax.set_xticks(x_pos)
            ax.set_xticklabels(x_labels,
                rotation=30, ha='right', fontsize=8)

        # Title
        if title:
            fig_obj.text(0.5, 0.97, title,
                         ha='center', va='top',
                         fontsize=11, fontweight='bold',
                         color='#243a5e',
                         transform=fig_obj.transFigure)

        buf = io.BytesIO()
        fig_obj.savefig(buf, format='png', dpi=dpi,
                        bbox_inches='tight',
                        facecolor='white', edgecolor='none')
        buf.seek(0)
        plt.close(fig_obj)
        return buf.getvalue()

    except Exception as e:
        print(f"[mpl_chart_to_png_bytes] error: {e}")
        import traceback
        traceback.print_exc()
        plt.close('all')
        return None


# ──────────────────────────────────────────────────────────
# REQUEST MODELS
# ──────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    question:             str
    chat_history:         Optional[List] = []
    chart_type_override:  Optional[str]  = "Auto (AI decides)"
    show_data_labels:     Optional[bool] = True
    label_position:       Optional[str]  = "outside"
    # NEW: Add filter support
    filter_function:      Optional[str]  = "All"
    filter_role:          Optional[str]  = "All"
    filter_status:        Optional[str]  = "All"
    filter_year:          Optional[str]  = "All"

# ──────────────────────────────────────────────────────────
# BASIC ENDPOINTS
# ──────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "Gen BI Agent API is running",
            "version": "1.0.0"}


@app.get("/api/health")
def health():
    ok, msg = test_connection()
    return {"connected": ok, "message": msg}


@app.get("/api/schema")
def schema():
    return {"schema": get_table_schema()}


@app.get("/api/chart-types")
def chart_types():
    return {"types": CHART_TYPES}


@app.get("/api/quick-questions")
def quick_questions():
    return {
        "questions": [
            {"label": k, "prompt": v}
            for k, v in QUICK_QUESTIONS.items()
        ]
    }


# ──────────────────────────────────────────────────────────
# KPI ENDPOINT
# ──────────────────────────────────────────────────────────
@app.get("/api/kpis")
def kpis():
    """
    Returns 5 live KPI values from Snowflake.
    All values are guaranteed to be numbers (never undefined).
    """
    sql = f"""
        SELECT
            SUM(DEMAND)                                           AS TOTAL_DEMAND,
            SUM(CAPACITY)                                         AS TOTAL_CAPACITY,
            SUM(DEMAND - CAPACITY)                                AS TOTAL_GAP,
            ROUND(AVG(CAPACITY_CONSTRAINT / NULLIF(CAPACITY,0) * 100), 1)
                                                                  AS AVG_UTILIZATION,
            COUNT(DISTINCT CASE WHEN PROJECT_STATUS = 'At Risk'
                  THEN PROJECT_NAME END)                          AS AT_RISK_PROJECTS
        FROM {FTBL}
    """
    df, err = run_query(sql)

    if err:
        print(f"[/api/kpis] PostgreSQL error: {err}")
        return {
            "total_demand"    : 0,
            "total_capacity"  : 0,
            "total_gap"       : 0,
            "avg_utilization" : 0,
            "at_risk_projects": 0,
            "error"           : err,
        }

    if df is None or df.empty:
        return {
            "total_demand"    : 0,
            "total_capacity"  : 0,
            "total_gap"       : 0,
            "avg_utilization" : 0,
            "at_risk_projects": 0,
        }

    # Use positional access — column names may vary in case
    row = df.iloc[0]
    return {
        "total_demand"    : float(row.iloc[0] or 0),
        "total_capacity"  : float(row.iloc[1] or 0),
        "total_gap"       : float(row.iloc[2] or 0),
        "avg_utilization" : float(row.iloc[3] or 0),
        "at_risk_projects": int(row.iloc[4]   or 0),
    }

@app.get("/api/filters")
def get_filters():
    """Returns all unique filter values for dashboard dropdowns"""
    try:
        sql = f"""
            SELECT DISTINCT
                FUNCTION,
                ROLE,
                PROJECT_STATUS,
                EXTRACT(YEAR FROM date)::INT AS yr
            FROM {FTBL}
            WHERE FUNCTION IS NOT NULL
              AND ROLE IS NOT NULL
              AND PROJECT_STATUS IS NOT NULL
              AND DATE IS NOT NULL
            ORDER BY 1,2,3,4
        """
        df, err = run_query(sql)
        if err or df is None or df.empty:
            return {"functions":[],"roles":[],"statuses":[],"years":[]}
        return {
            "functions": sorted(df["FUNCTION"].dropna().unique().tolist()),
            "roles"    : sorted(df["ROLE"].dropna().unique().tolist()),
            "statuses" : sorted(df["PROJECT_STATUS"].dropna().unique().tolist()),
            "years"    : sorted(
                [int(x) for x in df["YR"].dropna().unique().tolist()],
                reverse=True
            ),
        }
    except Exception as e:
        print(f"[/api/filters] error: {e}")
        return {"functions":[],"roles":[],"statuses":[],"years":[]}

@app.get("/api/full-data")
def get_full_data():
    """Returns the FULL dataset for client-side filtering."""
    try:
        sql = f"SELECT * FROM {FTBL}"
        df, err = run_query(sql)
        if err or df is None or df.empty:
            return {"data": [], "columns": [], "error": err}
        
        return {
            "data": df_to_records(df),
            "columns": list(df.columns),
        }
    except Exception as e:
        print(f"[/api/full-data] error: {e}")
        return {"data": [], "columns": [], "error": str(e)}
    
    

@app.post("/api/kpis/filtered")
def get_kpis_filtered(body: dict):
    """Returns KPI values filtered by the 4 dashboard dropdowns"""
    func   = body.get("function","All")
    role   = body.get("role","All")
    status = body.get("status","All")
    year   = body.get("year","All")

    where = ["1=1"]
    if func   != "All": where.append(f"FUNCTION = '{func}'")
    if role   != "All": where.append(f"ROLE = '{role}'")
    if status != "All": where.append(f"PROJECT_STATUS = '{status}'")
    if year   != "All": where.append(f"EXTRACT(YEAR FROM date) = {int(year)}")
    sql = f"""
        SELECT
            SUM(DEMAND)                                         AS TOTAL_DEMAND,
            SUM(CAPACITY)                                       AS TOTAL_CAPACITY,
            SUM(DEMAND - CAPACITY)                              AS TOTAL_GAP,
            ROUND(AVG(CAPACITY_CONSTRAINT/NULLIF(CAPACITY,0)*100),1)  AS AVG_UTILIZATION,
            COUNT(DISTINCT CASE WHEN PROJECT_STATUS='At Risk'
                  THEN PROJECT_NAME END)                        AS AT_RISK_PROJECTS
        FROM {FTBL}
        WHERE {" AND ".join(where)}
    """
    df, err = run_query(sql)
    if err or df is None or df.empty:
        return {"total_demand":0,"total_capacity":0,
                "total_gap":0,"avg_utilization":0,"at_risk_projects":0}
    row = df.iloc[0]
    return {
        "total_demand"    : float(row.iloc[0] or 0),
        "total_capacity"  : float(row.iloc[1] or 0),
        "total_gap"       : float(row.iloc[2] or 0),
        "avg_utilization" : float(row.iloc[3] or 0),
        "at_risk_projects": int(row.iloc[4]   or 0),
    }


# ──────────────────────────────────────────────────────────
# MAIN QUERY ENDPOINT
# ──────────────────────────────────────────────────────────
@app.post("/api/query")
async def query(req: QueryRequest):
    """Main pipeline endpoint with optional dashboard filters."""
    try:
        result = ask_ai(req.question, req.chat_history)

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])

        df = result.get("data")
        sql = result.get("sql", "")

        # Apply filters using pandas
        if df is not None and not df.empty:
            if req.filter_function and req.filter_function != "All":
                if "FUNCTION" in df.columns:
                    df = df[df["FUNCTION"] == req.filter_function].copy()
            
            if req.filter_role and req.filter_role != "All":
                if "ROLE" in df.columns:
                    df = df[df["ROLE"] == req.filter_role].copy()
            
            if req.filter_status and req.filter_status != "All":
                if "PROJECT_STATUS" in df.columns:
                    df = df[df["PROJECT_STATUS"] == req.filter_status].copy()
            
            if req.filter_year and req.filter_year != "All":
                year_col = None
                for col in ["DATE", "YEAR", "YEAR_DATE"]:
                    if col in df.columns:
                        year_col = col
                        break
                
                if year_col:
                    try:
                        df[year_col] = pd.to_datetime(df[year_col], errors='coerce')
                        df = df[df[year_col].dt.year == int(req.filter_year)].copy()
                    except:
                        pass

        if df is None or df.empty:
            return {
                "data": [], "columns": [], "num_columns": [], "text_columns": [],
                "row_count": 0, "sql": sql,
                "explanation": result.get("explanation", ""),
                "chart_config": result.get("chart_config", {}),
                "summary_data": result.get("summary_data", {}),
                "synonyms_used": result.get("synonyms_used", []),
            }

        df = coerce_numeric_columns(df)
        cols = list(df.columns)
        num_cols = df.select_dtypes(include='number').columns.tolist()
        text_cols = df.select_dtypes(exclude='number').columns.tolist()

        return {
            "data": df_to_records(df),
            "columns": cols,
            "num_columns": num_cols,
            "text_columns": text_cols,
            "row_count": len(df),
            "sql": sql,
            "explanation": result.get("explanation", ""),
            "chart_config": result.get("chart_config", {}),
            "summary_data": result.get("summary_data", {}),
            "synonyms_used": result.get("synonyms_used", []),
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────
# RUN CUSTOM SQL
# ──────────────────────────────────────────────────────────
@app.post("/api/run-sql")
async def run_sql(body: dict):
    """Execute custom SQL from the SQL tab editor."""
    sql = body.get("sql", "").strip()
    if not sql:
        raise HTTPException(
            status_code=400, detail="No SQL provided")
    df, err = run_query(sql)
    if err:
        raise HTTPException(status_code=400, detail=err)
    cols = list(df.columns)
    return {
        "data"     : df_to_records(df),
        "columns"  : cols,
        "row_count": len(df),
    }


# ──────────────────────────────────────────────────────────
# SINGLE CHART PDF EXPORT (from Visual tab)
# ──────────────────────────────────────────────────────────
@app.post("/api/export/chart-pdf")
async def export_chart_pdf(body: dict):
    """Export a single chart from the Visual tab as PDF."""
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer)
        from reportlab.platypus import Image as RLImage
        from reportlab.lib.styles import (
            getSampleStyleSheet, ParagraphStyle)
        from reportlab.lib.units import inch
        from reportlab.lib import colors

        data        = body.get("data", [])
        chart_type  = body.get("chart_type", "bar")
        title       = body.get("title", "Chart")
        show_labels = body.get("show_labels", True)

        if not data:
            raise HTTPException(
                status_code=400, detail="No data provided")

        png = mpl_chart_to_png_bytes(
            data, chart_type, title,
            show_labels, fig_w=10, fig_h=5)

        if not png:
            raise HTTPException(
                status_code=500, detail="Chart render failed")

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=landscape(A4),
            leftMargin=0.4*inch, rightMargin=0.4*inch,
            topMargin=0.4*inch,  bottomMargin=0.4*inch)

        styl = getSampleStyleSheet()
        ts   = ParagraphStyle(
            'T', parent=styl['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#243a5e'))

        ib = io.BytesIO(png)
        ib.seek(0)
        story = [
            Paragraph(title, ts),
            Spacer(1, 0.1*inch),
            RLImage(ib, width=9.5*inch, height=5*inch),
        ]
        doc.build(story)
        pdf_bytes = buf.getvalue()

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition":
                    f'attachment; filename="{title[:20]}.pdf"',
                "Content-Length": str(len(pdf_bytes)),
            })

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────
# SINGLE CHART EXCEL EXPORT (from Visual tab)
# ──────────────────────────────────────────────────────────
@app.post("/api/export/chart-excel")
async def export_chart_excel(body: dict):
    """Export a single chart's data as Excel."""
    data  = body.get("data", [])
    title = body.get("title", "Data")

    if not data:
        raise HTTPException(
            status_code=400, detail="No data provided")

    df  = pd.DataFrame(data)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as w:
        df.to_excel(w, index=False, sheet_name='Data')
    buf.seek(0)
    excel_bytes = buf.getvalue()

    safe = title.replace(" ", "_")[:20]
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type=(
            "application/vnd.openxmlformats-officedocument"
            ".spreadsheetml.sheet"),
        headers={
            "Content-Disposition":
                f'attachment; filename="{safe}.xlsx"',
            "Content-Length": str(len(excel_bytes)),
        })


# ──────────────────────────────────────────────────────────
# FULL DASHBOARD PDF EXPORT
# ──────────────────────────────────────────────────────────
@app.post("/api/export/dashboard-pdf")
async def export_dashboard_pdf(body: dict):
    """Simple PDF export for dashboard"""
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        import io
        
        items = body.get("items", [])
        if not items:
            raise HTTPException(status_code=400, detail="No dashboard items provided")

        # Create PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        story.append(Paragraph("Gen BI Agent - Dashboard", styles['Title']))
        story.append(Spacer(1, 0.2*inch))
        
        # Add each chart
        for item in items:
            title = item.get("title", "Chart")
            data = item.get("data", [])
            ctype = item.get("fixed_ctype", "bar")
            
            # Add title
            story.append(Paragraph(title, styles['Heading2']))
            story.append(Spacer(1, 0.1*inch))
            
            # Generate chart image
            if data:
                png_bytes = mpl_chart_to_png_bytes(data, ctype, title, True, fig_w=10, fig_h=5)
                if png_bytes:
                    img_buffer = io.BytesIO(png_bytes)
                    img = Image(img_buffer, width=10*inch, height=5*inch)
                    story.append(img)
                    story.append(Spacer(1, 0.3*inch))
            
            # Page break after every 2 charts
            if items.index(item) % 2 == 1 and items.index(item) != len(items) - 1:
                doc.build(story)
                story = []
                doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        
        # Build final PDF
        doc.build(story)
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        
        print(f"[PDF] Generated {len(pdf_bytes)} bytes")
        
        if not pdf_bytes or len(pdf_bytes) < 100:
            raise Exception("PDF is too small - likely empty")
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=dashboard.pdf"}
        )
        
    except Exception as e:
        import traceback
        print(f"[PDF ERROR] {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────
# FULL DASHBOARD EXCEL EXPORT
# ──────────────────────────────────────────────────────────
@app.post("/api/export/dashboard-excel")
async def export_dashboard_excel(body: dict):
    """
    Export all dashboard tiles as a multi-sheet Excel file.
    Dashboard sheet has embedded chart images.
    Each tile also gets its own data sheet.
    """
    try:
        from openpyxl import Workbook
        from openpyxl.drawing.image import Image as XLImg
        from openpyxl.styles import (Font, PatternFill,
                                      Alignment, Border, Side)
        from openpyxl.utils import get_column_letter
        import PIL.Image

        items = body.get("items", [])
        if not items:
            raise HTTPException(
                status_code=400,
                detail="No dashboard items provided")

        n_cols   = 2
        wb       = Workbook()
        ws_d     = wb.active
        ws_d.title = "Dashboard"
        ws_d.sheet_view.showGridLines = False

        # Header row
        hfill = PatternFill("solid", fgColor="243A5E")
        hfont = Font(bold=True, color="FFFFFF", size=13)
        ws_d.merge_cells("A1:Z1")
        ws_d["A1"]           = "Gen BI Agent — Dashboard"
        ws_d["A1"].font      = hfont
        ws_d["A1"].fill      = hfill
        ws_d["A1"].alignment = Alignment(
            horizontal="center", vertical="center")
        ws_d.row_dimensions[1].height = 26

        img_w_in = max(3.5, 8.0 / n_cols)
        img_h_in = 2.8
        img_w_px = int(img_w_in * 150)
        img_h_px = int(img_h_in * 150)
        rows_per = int(img_h_px / 15) + 2
        rows     = [items[i:i+n_cols]
                    for i in range(0, len(items), n_cols)]
        erow     = 2

        for row in rows:
            ecol = 1
            for item in row:
                ctype  = item.get("fixed_ctype", "bar")
                data   = item.get("data",   [])
                title  = item.get("title",  "")
                show_l = item.get("saved_show_labels", True)

                if ctype != "kpi_cards" and data:
                    png = mpl_chart_to_png_bytes(
                        data, ctype, title,
                        show_l,
                        fig_w=img_w_in,
                        fig_h=img_h_in,
                        dpi=120)
                    if png:
                        pil = PIL.Image.open(io.BytesIO(png))
                        ib  = io.BytesIO()
                        pil.save(ib, format="PNG")
                        ib.seek(0)
                        xl         = XLImg(ib)
                        xl.width   = img_w_px
                        xl.height  = img_h_px
                        cell_ref   = (get_column_letter(ecol)
                                      + str(erow))
                        ws_d.add_image(xl, cell_ref)

                ecol += max(1, int(img_w_px / 8 / 7))

            for r in range(erow, erow + rows_per):
                ws_d.row_dimensions[r].height = 15
            erow += rows_per + 1

        # Set column widths for Dashboard sheet
        for c in range(1, 80):
            ws_d.column_dimensions[
                get_column_letter(c)].width = 8

        # One data sheet per tile
        thin = Side(style="thin", color="D0D7E3")
        bdr  = Border(left=thin, right=thin,
                      top=thin,  bottom=thin)

        for i, item in enumerate(items):
            data  = item.get("data",  [])
            title = item.get("title", f"V{i+1}")
            if not data:
                continue

            sheet = (title[:25]
                     .replace(" ", "_")
                     .replace("/", "_")
                     .replace("?", ""))
            ws    = wb.create_sheet(title=sheet)

            df_i  = pd.DataFrame(data)
            hf2   = PatternFill("solid", fgColor="2B579A")
            hfn2  = Font(bold=True, color="FFFFFF", size=10)

            for ci, col in enumerate(df_i.columns, start=1):
                cell           = ws.cell(row=1, column=ci,
                                          value=col)
                cell.fill      = hf2
                cell.font      = hfn2
                cell.alignment = Alignment(
                    horizontal="center", vertical="center")
                cell.border    = bdr

            a1 = PatternFill("solid", fgColor="EBF3FB")
            a2 = PatternFill("solid", fgColor="FFFFFF")

            for ri, r_data in enumerate(
                    df_i.itertuples(index=False), start=2):
                f = a1 if ri % 2 == 0 else a2
                for ci, val in enumerate(r_data, start=1):
                    c2            = ws.cell(row=ri,
                                            column=ci,
                                            value=val)
                    c2.fill       = f
                    c2.border     = bdr
                    c2.alignment  = Alignment(
                        horizontal="left",
                        vertical  ="center")

            # Auto column widths
            for col in ws.columns:
                mx = max(
                    (len(str(c2.value))
                     for c2 in col if c2.value),
                    default=8)
                ws.column_dimensions[
                    get_column_letter(
                        col[0].column)].width = min(mx+4, 35)

            ws.freeze_panes = "A2"

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        excel_bytes = buf.getvalue()

        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type=(
                "application/vnd.openxmlformats-officedocument"
                ".spreadsheetml.sheet"),
            headers={
                "Content-Disposition":
                    'attachment; filename="dashboard.xlsx"',
                "Content-Length": str(len(excel_bytes)),
            })

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))