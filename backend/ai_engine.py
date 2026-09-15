# ai_engine.py
from groq import Groq
import os, re, json
from dotenv import load_dotenv
from pg_connector import run_query, get_table_schema  # ← CHANGED

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

SYNONYMS = {
    "function": [
        "department","dept","team","division","group",
        "business unit","BU","vertical","practice",
        "stream","unit","section","functional area"
    ],
    "subfunction": [
        "sub department","sub dept","sub team","sub division",
        "sub group","sub function","sub unit","sub area"
    ],
    "role": [
        "designation","position","title","job title","grade",
        "level","profile","band","job role","seniority","skill",
        "resource type","FTE type"
    ],
    "portfolio": [
        "portfolio name","program","programme","initiative",
        "workstream","work stream"
    ],
    "project_name": [
        "project","engagement","work order","assignment",
        "delivery","project name"
    ],
    "product": ["product name","solution","offering","service","product line"],
    "study":   ["study name","analysis","research","investigation","assessment"],
    "date": [
        "month","period","time","when","timeline","reporting date",
        "reporting month","jan","feb","mar","apr","may","jun",
        "jul","aug","sep","oct","nov","dec","january","february",
        "march","april","june","july","august","september",
        "october","november","december","Q1","Q2","Q3","Q4",
        "quarter","this month","last month","this year","YTD"
    ],
    "project_start_date": ["start date","start","kick off","begin date","project start"],
    "project_end_date":   ["end date","end","completion date","deadline","finish date"],
    "project_status":     ["status","health","project health","state","condition","flag"],
    "demand": [
        "total demand","demand hours","requirement","required",
        "need","ask","forecast","workforce demand","resource demand",
        "FTE demand","headcount demand","FTE","headcount","head count",
        "HC","people","staff","resources","workforce","employees",
        "manpower","strength","people needed","resources needed","planned demand"
    ],
    "capacity": [
        "total capacity","supply","bandwidth","availability",
        "available capacity","total supply","resource capacity",
        "FTE capacity","headcount capacity","people available",
        "resources available","maximum capacity","capacity hours","bench"
    ],
    "capacity_constraint": [
        "capacity consumed", "consumed capacity", "utilized capacity",
        "used capacity", "actual utilization", "consumption",
        "capacity used", "hours consumed", "booked capacity",
        "engaged capacity", "deployed capacity", "allocated hours",
        "capacity constraint"
    ],
}

CALCULATED_METRICS = {
    "gap":  "(SUM(demand) - SUM(capacity)) AS demand_gap",
    "shortage":  "(SUM(demand) - SUM(capacity)) AS shortage",
    "demand gap":  "(SUM(demand) - SUM(capacity)) AS demand_gap",
    "available capacity":  "(SUM(capacity) - SUM(capacity_constraint)) AS available_capacity",
    "free capacity":  "(SUM(capacity) - SUM(capacity_constraint)) AS free_capacity",
    "utilization":  "ROUND(SUM(capacity_constraint)/NULLIF(SUM(capacity),0)*100,2) AS utilization_pct",
    "over utilized":  "SUM(capacity_constraint) > SUM(capacity)",
    "under utilized":  "SUM(capacity_constraint) < SUM(capacity) * 0.7",
    "utilization percentage":  "ROUND(SUM(capacity_constraint)/NULLIF(SUM(capacity),0)*100,2) AS utilization_pct",
    "at risk":  "project_status ILIKE '%At Risk%'",
    "on track":  "project_status ILIKE '%On Track%'",
    "risk":  "project_status ILIKE '%Risk%'",
}

BUSINESS_INTENTS = {
    "shortage":  "GROUP BY function ORDER BY (SUM(demand)-SUM(capacity)) DESC",
    "highest gap":  "GROUP BY function ORDER BY ABS(SUM(demand)-SUM(capacity)) DESC LIMIT 10",
    "most critical":  "GROUP BY function ORDER BY (SUM(demand)-SUM(capacity)) ASC LIMIT 10",
    "over utilized":  "HAVING SUM(capacity_constraint) > SUM(capacity)",
    "under utilized":  "HAVING SUM(capacity_constraint) < SUM(capacity) * 0.7",
    "at risk":  "WHERE project_status ILIKE '%At Risk%' GROUP BY function, project_name",
    "risk projects":  "WHERE project_status ILIKE '%Risk%' GROUP BY function, project_name",
    "utilization":  "GROUP BY function ORDER BY utilization_pct DESC",
    "percentage":  "GROUP BY function",
    "top 5":  "ORDER BY ... DESC LIMIT 5",
    "top 10":  "ORDER BY ... DESC LIMIT 10",
    "bottom 5":  "ORDER BY ... ASC LIMIT 5",
    "trend":  "GROUP BY date ORDER BY date",
    "by month":  "GROUP BY date ORDER BY date",
    "compare":  "GROUP BY function ORDER BY ...",
    "distribution":  "GROUP BY function ORDER BY COUNT(*) DESC",
}

def build_synonym_prompt() -> str:
    lines = ["SYNONYM RULES — map user words to exact column names:\n"]
    for col, synonyms in SYNONYMS.items():
        lines.append(f"  If user says any of: {synonyms}")
        lines.append(f"  → USE COLUMN: {col}\n")
    lines.append("CALCULATED METRICS — not stored, compute in SQL:")
    for phrase, sql_expr in CALCULATED_METRICS.items():
        lines.append(f'  "{phrase}" → {sql_expr}')
    lines.append("\nBUSINESS INTENT PATTERNS:")
    for intent, sql_pattern in BUSINESS_INTENTS.items():
        lines.append(f'  "{intent}" → {sql_pattern}')
    return "\n".join(lines)

def resolve_synonyms_in_question(question: str) -> tuple:
    q = question
    mapping_log = []
    for col, synonyms in SYNONYMS.items():
        for syn in sorted(synonyms, key=len, reverse=True):
            pattern = re.compile(r'\b' + re.escape(syn) + r'\b', re.IGNORECASE)
            if pattern.search(q):
                q = pattern.sub(col, q)
                mapping_log.append(f'"{syn}" → {col}')
                break
    return q, mapping_log

def extract_sql(text: str) -> str:
    pattern = r"```sql\s*(.*?)\s*```"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    for line in text.split('\n'):
        if line.strip().upper().startswith('SELECT'):
            return line.strip()
    return ""

def get_chart_config(question: str, columns: list) -> dict:
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role":"user","content":f"""
User question: "{question}"
Data columns returned: {columns}
Pick the best chart type:
- 2+ numeric columns        → "grouped_bar"
- "trend","month","date"    → "line"
- "distribution","share","%" → "pie"
- "top","highest","lowest"  → "horizontal_bar"
- "compare","vs"            → "grouped_bar"
- default                   → "bar"
Return ONLY valid JSON (no explanation, no backticks):
{{"chart_type":"bar","x_axis":"text_col","y_axis":"numeric_col","color_by":null,"title":"title"}}
"""}],
            max_tokens=300)
        text = resp.choices[0].message.content.strip()
        text = text.replace("```json","").replace("```","").strip()
        return json.loads(text)
    except:
        text_cols = [c for c in columns if c.lower() in [
            'function','subfunction','role','portfolio',
            'project_name','product','study','project_status']]
        num_cols = [c for c in columns if any(
            x in c.lower() for x in [
                'demand','capacity','constraint','gap','shortage',
                'pct','total','sum','count','avg'])]
        return {
            "chart_type": "grouped_bar" if len(num_cols)>=2 else "bar",
            "x_axis": text_cols[0] if text_cols else columns[0],
            "y_axis": num_cols[0] if num_cols else columns[-1],
            "color_by": None,
            "title": "Query Results"
        }

def generate_summary_and_followups(question: str, df_preview: str, chart_title: str) -> dict:
    try:
        prompt = f"""
You are a business intelligence analyst.
User asked: "{question}"
Chart title: "{chart_title}"
Data preview (first 5 rows):
{df_preview}

Generate:
1. A 2-3 sentence business insight summary. Be specific about the numbers.
2. Exactly 3 follow-up questions the user would naturally ask next.
   - Each question MUST be directly answerable using the columns shown in the preview.
    - Use exact business terms from the data (e.g., function, role, demand, capacity).
   - Focus on comparisons, top/bottom rankings, trends, or breakdowns.
   - NO vague questions like "show more" or "explain".

Return ONLY valid JSON (no explanation, no backticks):
{{
    "summary": "2-3 sentence insight here...",
    "followup_questions": [
        "First data-specific follow-up question?",
        "Second data-specific follow-up question?",
        "Third data-specific follow-up question?"
    ]
}}
"""
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500)
        text = resp.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except:
        return {
            "summary": "Data retrieved successfully. Review the chart and table for insights.",
            "followup_questions": [
                "Show this data broken down by role?",
                "Which items have the highest demand_gap?",
                "Show the trend over date?"
            ]
        }

def ask_ai(question: str, history: list = []) -> dict:
    schema = os.getenv("PG_SCHEMA", "final")  # ← CHANGED
    table = os.getenv("PG_TABLE", "company_x_final_table")  # ← CHANGED
    full_table = f"{schema}.{table}"  # ← CHANGED
    tbl_schema = get_table_schema()

    resolved_q, mapping_log = resolve_synonyms_in_question(question)

    if mapping_log:
        print(f"\n SYNONYM RESOLUTION:")
        print(f"   Original : {question}")
        print(f"   Resolved : {resolved_q}")
        print(f"   Mappings : {mapping_log}\n")

    synonym_block = build_synonym_prompt()

    system_prompt = f"""You are an expert PostgreSQL SQL analyst for project resource planning.  # ← CHANGED

YOUR TABLE:
{tbl_schema}

FULL TABLE NAME: {full_table}

{synonym_block}

CRITICAL SQL RULES:
1. ALWAYS use full table name: {full_table}
2. PostgreSQL SQL ONLY  # ← CHANGED
3. ALWAYS wrap SQL in ```sql ``` markers
4. SELECT queries ONLY
5. DEMAND_GAP is NOT a column — calculate it:
    (SUM(demand) - SUM(capacity)) AS demand_gap
6. UTILIZATION is NOT a column — calculate it:
    ROUND(SUM(capacity_constraint)/NULLIF(SUM(capacity),0)*100,2) AS utilization_pct
7. ALWAYS use GROUP BY when using SUM/AVG/COUNT
8. Default LIMIT 10 unless user specifies
9. ALWAYS use NULLIF(capacity,0) to avoid division by zero
10. For status: WHERE project_status ILIKE '%At Risk%'
11. Use EXTRACT(YEAR FROM "date") instead of YEAR(date)
12. Use EXTRACT(MONTH FROM "date") instead of MONTH(date)
13. ILIKE is case-insensitive LIKE (PostgreSQL specific)

RESPONSE FORMAT:
1. One sentence: what you understood
2. SQL in ```sql markers
3. One sentence: what result shows
"""

    messages = [{"role":"system","content":system_prompt}]
    for h in history[-6:]:
        messages.append({"role":h["role"],"content":h["content"]})
    messages.append({"role":"user","content":resolved_q})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=1500)

    ai_text = response.choices[0].message.content
    sql = extract_sql(ai_text)
    df = None
    error = None
    chart = None
    summary_data = None

    if sql:
        df, error = run_query(sql)
        if df is not None and not df.empty:
            chart = get_chart_config(question, list(df.columns))
            df_preview = df.head(5).to_string(index=False)
            chart_title = chart.get("title","Results") if chart else "Results"
            summary_data = generate_summary_and_followups(
                question, df_preview, chart_title)

    if mapping_log:
        note = "\n\n SYNONYMS AUTO-RESOLVED:\n"
        note += "\n".join([f"  • {m}" for m in mapping_log])
        ai_text += note

    return {
        "explanation": ai_text,
        "sql": sql,
        "data": df,
        "error": error,
        "chart_config": chart,
        "synonyms_used": mapping_log,
        "summary_data": summary_data,
    }