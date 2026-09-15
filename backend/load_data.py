# load_data.py
# Loads all 4 sheets from Clinical Excel file into PostgreSQL

import pandas as pd
from sqlalchemy import create_engine, text
import os
import math
import numpy as np
from dotenv import load_dotenv
load_dotenv()

# ── Connection from your .env file ───────────────────────
HOST = os.getenv("PG_HOST")
PORT = int(os.getenv("PG_PORT", 5432))
DB   = os.getenv("PG_DATABASE")
USER = os.getenv("PG_USER")
PASS = os.getenv("PG_PASSWORD")
SCALE_FACTOR = max(1, int(os.getenv("DATA_SCALE_FACTOR", "1")))
TARGET_ROWS = max(0, int(os.getenv("DATA_TARGET_ROWS", "0")))

EXCEL = os.path.join(os.path.dirname(__file__),
        "Clinical_Trials_GenBI_Dummy_Data.xlsx")

conn_str = (f"postgresql+psycopg2://{USER}:{PASS}"
            f"@{HOST}:{PORT}/{DB}")


def scale_rows(df: pd.DataFrame, factor: int, id_columns=None) -> pd.DataFrame:
    """Duplicate rows by factor and suffix ID columns to keep keys unique."""
    if factor <= 1 or df is None or df.empty:
        return df

    id_columns = id_columns or []
    frames = [df]
    for i in range(1, factor):
        dup = df.copy()
        suffix = f"_x{i+1}"
        for col in id_columns:
            if col in dup.columns:
                dup[col] = dup[col].astype(str) + suffix
        frames.append(dup)

    return pd.concat(frames, ignore_index=True)


def generate_new_rows(df: pd.DataFrame, target_rows: int, id_columns=None) -> pd.DataFrame:
    """Keep original rows and append varied synthetic rows until target is reached."""
    if target_rows <= 0 or df is None or df.empty:
        return df

    if len(df) >= target_rows:
        return df.head(target_rows).copy()

    id_columns = id_columns or []
    rng = np.random.default_rng(2026)
    source = df.copy().reset_index(drop=True)
    generated_parts = []
    remaining = target_rows - len(source)
    serial = 1

    while remaining > 0:
        take = min(len(source), remaining)
        sampled = source.sample(n=take, replace=True).reset_index(drop=True)

        # Create value variations for numeric/date/categorical fields.
        for col in sampled.columns:
            if col in id_columns:
                continue

            series = sampled[col]
            if pd.api.types.is_datetime64_any_dtype(series):
                offsets = pd.to_timedelta(rng.integers(1, 120, size=take), unit="D")
                sampled[col] = series + offsets
            elif pd.api.types.is_numeric_dtype(series):
                factors = rng.uniform(0.85, 1.20, size=take)
                varied = pd.to_numeric(series, errors="coerce").fillna(0).to_numpy() * factors
                if pd.api.types.is_integer_dtype(df[col]):
                    varied = np.rint(varied).astype(int)
                    varied = np.clip(varied, 0, None)
                else:
                    varied = np.round(varied, 3)
                sampled[col] = varied
            elif pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
                uniques = source[col].dropna().astype(str).unique().tolist()
                if uniques:
                    mask = rng.random(size=take) < 0.25
                    if mask.any():
                        sampled.loc[mask, col] = rng.choice(uniques, size=int(mask.sum()))

        for col in id_columns:
            if col in sampled.columns:
                sampled[col] = [f"{val}_N{serial + i}" for i, val in enumerate(sampled[col].astype(str))]

        serial += take
        generated_parts.append(sampled)
        remaining -= take

    combined = pd.concat([source] + generated_parts, ignore_index=True)
    return combined.head(target_rows).copy()


def size_rows(df: pd.DataFrame, id_columns=None) -> pd.DataFrame:
    if TARGET_ROWS > 0:
        return generate_new_rows(df, TARGET_ROWS, id_columns=id_columns)
    return scale_rows(df, SCALE_FACTOR, id_columns=id_columns)


def truncate_table(engine, schema: str, table: str) -> None:
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {schema}.{table} RESTART IDENTITY"))


def load_table(df: pd.DataFrame, engine, schema: str, table: str) -> None:
    # Keep your existing table definition (serial id, numeric types, etc.)
    truncate_table(engine, schema, table)
    df.to_sql(
        table,
        engine,
        schema=schema,
        if_exists="append",
        index=False,
        chunksize=500,
        method="multi",
    )


def replace_table(df: pd.DataFrame, engine, schema: str, table: str) -> None:
    """Create or replace generated tables based on DataFrame columns."""
    df.to_sql(
        table,
        engine,
        schema=schema,
        if_exists="replace",
        index=False,
        chunksize=500,
        method="multi",
    )


def make_additional_tables(df_trials: pd.DataFrame, df_sites: pd.DataFrame):
    """Build 11 additional synthetic clinical tables from existing IDs."""
    rng = np.random.default_rng(42)

    study_ids = df_trials["study_id"].dropna().astype(str).unique().tolist()
    site_ids = df_sites["site_id"].dropna().astype(str).unique().tolist()
    n = TARGET_ROWS if TARGET_ROWS > 0 else max(len(df_trials), 1000)

    if not study_ids:
        study_ids = ["STUDY-001"]
    if not site_ids:
        site_ids = ["SITE-001"]

    studies = np.resize(np.array(study_ids, dtype=object), n)
    sites = np.resize(np.array(site_ids, dtype=object), n)

    base_day = pd.Timestamp("2024-01-01")
    day_offsets = pd.to_timedelta(rng.integers(0, 540, size=n), unit="D")

    enrollment = pd.DataFrame({
        "study_id": studies,
        "site_id": sites,
        "patient_id": [f"PT-{i+1:06d}" for i in range(n)],
        "screening_date": base_day + day_offsets,
        "enrolled_date": base_day + day_offsets + pd.to_timedelta(rng.integers(0, 20, size=n), unit="D"),
        "status": rng.choice(["Screened", "Enrolled", "Completed", "Withdrawn"], size=n, p=[0.18, 0.45, 0.29, 0.08]),
        "age": rng.integers(18, 85, size=n),
        "gender": rng.choice(["Female", "Male", "Other"], size=n, p=[0.49, 0.49, 0.02]),
    })

    adverse = pd.DataFrame({
        "study_id": studies,
        "site_id": sites,
        "event_id": [f"AE-{i+1:06d}" for i in range(n)],
        "event_date": base_day + day_offsets,
        "severity": rng.choice(["Mild", "Moderate", "Severe"], size=n, p=[0.62, 0.30, 0.08]),
        "seriousness": rng.choice(["Serious", "Non-serious"], size=n, p=[0.12, 0.88]),
        "outcome": rng.choice(["Recovered", "Recovering", "Not Recovered", "Fatal"], size=n, p=[0.72, 0.18, 0.095, 0.005]),
        "days_to_resolve": rng.integers(1, 60, size=n),
    })

    milestone_name = np.resize(np.array([
        "Protocol Finalized", "First Patient In", "Interim Analysis", "Last Patient In", "Database Lock"
    ], dtype=object), n)
    planned_offsets = rng.integers(10, 500, size=n)
    delay_days = rng.integers(-20, 70, size=n)
    protocol_milestones = pd.DataFrame({
        "study_id": studies,
        "milestone_name": milestone_name,
        "planned_date": base_day + pd.to_timedelta(planned_offsets, unit="D"),
        "actual_date": base_day + pd.to_timedelta(planned_offsets + delay_days, unit="D"),
        "status": np.where(delay_days <= 0, "On Track", np.where(delay_days <= 15, "Delayed", "At Risk")),
        "delay_days": delay_days,
    })

    monitoring = pd.DataFrame({
        "study_id": studies,
        "site_id": sites,
        "visit_date": base_day + day_offsets,
        "visit_type": rng.choice(["Initiation", "Routine", "Closeout", "For-cause"], size=n, p=[0.16, 0.60, 0.16, 0.08]),
        "findings_count": rng.integers(0, 20, size=n),
        "critical_findings": rng.integers(0, 5, size=n),
        "action_items_open": rng.integers(0, 12, size=n),
    })

    shipped = rng.integers(200, 3000, size=n)
    used = np.minimum(shipped, rng.integers(50, 2800, size=n))
    expired = rng.integers(0, 120, size=n)
    drug_supply = pd.DataFrame({
        "study_id": studies,
        "site_id": sites,
        "batch_id": [f"BAT-{i+1:06d}" for i in range(n)],
        "shipment_date": base_day + day_offsets,
        "units_shipped": shipped,
        "units_used": used,
        "units_expired": expired,
        "stockout_flag": rng.choice([0, 1], size=n, p=[0.95, 0.05]),
    })

    submitted_offsets = rng.integers(0, 500, size=n)
    cycle_days = rng.integers(15, 160, size=n)
    regulatory = pd.DataFrame({
        "study_id": studies,
        "country": rng.choice(["US", "IN", "UK", "DE", "FR", "JP", "AU"], size=n),
        "submission_type": rng.choice(["IND", "CTA", "Amendment", "Annual Report"], size=n, p=[0.18, 0.28, 0.34, 0.20]),
        "submitted_date": base_day + pd.to_timedelta(submitted_offsets, unit="D"),
        "approval_date": base_day + pd.to_timedelta(submitted_offsets + cycle_days, unit="D"),
        "status": rng.choice(["Approved", "Pending", "Rejected", "Query Raised"], size=n, p=[0.56, 0.28, 0.05, 0.11]),
        "cycle_days": cycle_days,
    })

    month_vals = rng.integers(1, 13, size=n)
    year_vals = rng.choice([2023, 2024, 2025, 2026], size=n, p=[0.08, 0.30, 0.34, 0.28])
    planned_cost = rng.uniform(0.1, 5.0, size=n).round(3)
    actual_cost = (planned_cost * rng.uniform(0.75, 1.35, size=n)).round(3)
    financial = pd.DataFrame({
        "study_id": studies,
        "month": month_vals,
        "year": year_vals,
        "planned_cost_m": planned_cost,
        "actual_cost_m": actual_cost,
        "variance_m": (actual_cost - planned_cost).round(3),
        "invoice_count": rng.integers(1, 18, size=n),
    })

    risk_register = pd.DataFrame({
        "study_id": studies,
        "risk_id": [f"RISK-{i+1:06d}" for i in range(n)],
        "risk_category": rng.choice(["Regulatory", "Operational", "Enrollment", "Safety", "Data Quality", "Budget"], size=n),
        "severity": rng.choice(["Low", "Medium", "High", "Critical"], size=n, p=[0.30, 0.42, 0.22, 0.06]),
        "probability": rng.choice(["Low", "Medium", "High"], size=n, p=[0.32, 0.48, 0.20]),
        "mitigation_owner": rng.choice(["Clinical Ops", "Data Mgmt", "Regulatory", "Safety", "Vendor Mgmt"], size=n),
        "status": rng.choice(["Open", "Mitigated", "Closed"], size=n, p=[0.46, 0.34, 0.20]),
    })

    vendor_perf = pd.DataFrame({
        "study_id": studies,
        "vendor_name": rng.choice(["IQVIA", "LabCorp", "Parexel", "ICON", "Syneos", "Medpace"], size=n),
        "service_type": rng.choice(["CRO", "Central Lab", "Imaging", "EDC", "Logistics"], size=n),
        "month": month_vals,
        "year": year_vals,
        "sla_target_pct": rng.choice([95, 96, 97, 98, 99], size=n),
        "sla_actual_pct": rng.uniform(88, 100, size=n).round(2),
        "incidents": rng.integers(0, 8, size=n),
    })

    active_patients = rng.integers(50, 1200, size=n)
    dropouts = rng.integers(0, 140, size=n)
    retention = pd.DataFrame({
        "study_id": studies,
        "site_id": sites,
        "month": month_vals,
        "year": year_vals,
        "active_patients": active_patients,
        "dropouts": dropouts,
        "retention_rate_pct": ((1 - (dropouts / np.maximum(active_patients, 1))) * 100).clip(0, 100).round(2),
    })

    opened_offsets = rng.integers(0, 500, size=n)
    resolution_days = rng.integers(1, 45, size=n)
    query_resolution = pd.DataFrame({
        "study_id": studies,
        "site_id": sites,
        "query_id": [f"QRY-{i+1:06d}" for i in range(n)],
        "opened_date": base_day + pd.to_timedelta(opened_offsets, unit="D"),
        "closed_date": base_day + pd.to_timedelta(opened_offsets + resolution_days, unit="D"),
        "priority": rng.choice(["Low", "Medium", "High", "Critical"], size=n, p=[0.22, 0.45, 0.25, 0.08]),
        "status": rng.choice(["Open", "In Progress", "Resolved"], size=n, p=[0.18, 0.38, 0.44]),
        "resolution_days": resolution_days,
    })

    return {
        "patient_enrollment": enrollment,
        "adverse_events": adverse,
        "protocol_milestones": protocol_milestones,
        "site_monitoring": monitoring,
        "drug_supply": drug_supply,
        "regulatory_submissions": regulatory,
        "financial_tracking": financial,
        "risk_register": risk_register,
        "vendor_performance": vendor_perf,
        "patient_retention": retention,
        "query_resolution": query_resolution,
    }

print("="*55)
print("Clinical Gen BI Agent — Data Loader")
print("="*55)
print(f"Data scale factor: {SCALE_FACTOR}x")
if TARGET_ROWS > 0:
    print(f"Target rows per table: {TARGET_ROWS}")

print("\nConnecting to PostgreSQL...")
engine = create_engine(conn_str, echo=False,
                       pool_pre_ping=True)
with engine.connect() as conn:
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS clinical"))
    r = conn.execute(text("SELECT version()"))
    print(f"Connected: {r.fetchone()[0][:55]} ✅")

# ────────────────────────────────────────────────────────
# LOAD 1: Clinical Resource Planning
# ────────────────────────────────────────────────────────
print("\n[1/4] Loading Clinical_Resource_Planning...")
df1 = pd.read_excel(EXCEL,
      sheet_name="Clinical_Resource_Planning")
df1.columns = [c.strip().lower() for c in df1.columns]
df1["date"] = pd.to_datetime(df1["date"], errors="coerce")
for col in ["demand","capacity","capacity_gap",
            "fte_cost","utilization_pct"]:
    df1[col] = pd.to_numeric(df1[col],
               errors="coerce").fillna(0)
for col in ["month","year"]:
    df1[col] = pd.to_numeric(df1[col],
               errors="coerce").fillna(0).astype(int)
df1 = size_rows(df1, id_columns=["study_id"])
load_table(df1, engine, "clinical", "resource_planning")
print(f"  Loaded {len(df1)} rows ✅")

# ────────────────────────────────────────────────────────
# LOAD 2: Clinical Trials
# ────────────────────────────────────────────────────────
print("\n[2/4] Loading Clinical_Trials...")
df2 = pd.read_excel(EXCEL, sheet_name="Clinical_Trials")
df2.columns = [c.strip().lower() for c in df2.columns]
df2["start_date"] = pd.to_datetime(
    df2["start_date"], errors="coerce")
df2["end_date"] = pd.to_datetime(
    df2["end_date"], errors="coerce")
for col in ["enrolled_patients","target_patients","sites"]:
    df2[col] = pd.to_numeric(df2[col],
               errors="coerce").fillna(0).astype(int)
df2["budget_m"] = pd.to_numeric(
    df2["budget_m"], errors="coerce").fillna(0)
df2 = size_rows(df2, id_columns=["study_id"])
load_table(df2, engine, "clinical", "clinical_trials")
print(f"  Loaded {len(df2)} rows ✅")

# ────────────────────────────────────────────────────────
# LOAD 3: Site Performance
# ────────────────────────────────────────────────────────
print("\n[3/4] Loading Site_Performance...")
df3 = pd.read_excel(EXCEL, sheet_name="Site_Performance")
df3.columns = [c.strip().lower() for c in df3.columns]
for col in ["target_enrollment","actual_enrollment",
            "screen_failures","dropouts","site_rating",
            "monitor_visits","query_count","open_actions"]:
    df3[col] = pd.to_numeric(df3[col],
               errors="coerce").fillna(0).astype(int)
df3 = size_rows(df3, id_columns=["study_id", "site_id"])
load_table(df3, engine, "clinical", "site_performance")
print(f"  Loaded {len(df3)} rows ✅")

# ────────────────────────────────────────────────────────
# LOAD 4: Clinical Data Management
# ────────────────────────────────────────────────────────
print("\n[4/4] Loading Clinical_Data_Management...")
df4 = pd.read_excel(EXCEL,
      sheet_name="Clinical_Data_Management")
df4.columns = [c.strip().lower() for c in df4.columns]
df4["last_refresh_date"] = pd.to_datetime(
    df4["last_refresh_date"], errors="coerce")
for col in ["open_queries","closed_queries",
            "missing_forms","sae_cases",
            "protocol_deviations"]:
    df4[col] = pd.to_numeric(df4[col],
               errors="coerce").fillna(0).astype(int)
df4["crf_completion_pct"] = pd.to_numeric(
    df4["crf_completion_pct"], errors="coerce").fillna(0)
df4 = size_rows(df4, id_columns=["study_id"])
load_table(df4, engine, "clinical", "data_management")
print(f"  Loaded {len(df4)} rows ✅")

# ────────────────────────────────────────────────────────
# LOAD 11 ADDITIONAL TABLES
# ────────────────────────────────────────────────────────
print("\n[5/15] Loading 11 additional generated tables...")
extra_tables = make_additional_tables(df2, df3)
for idx, (tbl_name, df_extra) in enumerate(extra_tables.items(), start=1):
    replace_table(df_extra, engine, "clinical", tbl_name)
    print(f"  [{idx:02d}/11] clinical.{tbl_name}: {len(df_extra)} rows ✅")

# ────────────────────────────────────────────────────────
# VERIFY ALL TABLES
# ────────────────────────────────────────────────────────
print("\nVerifying all tables...")
with engine.connect() as conn:
    all_tables = [
        "resource_planning", "clinical_trials",
        "site_performance", "data_management",
        "patient_enrollment", "adverse_events",
        "protocol_milestones", "site_monitoring",
        "drug_supply", "regulatory_submissions",
        "financial_tracking", "risk_register",
        "vendor_performance", "patient_retention",
        "query_resolution",
    ]
    for tbl in all_tables:
        r = conn.execute(
            text(f"SELECT COUNT(*) FROM clinical.{tbl}"))
        cnt = r.fetchone()[0]
        print(f"  clinical.{tbl}: {cnt} rows ✅")

engine.dispose()
print("\n" + "="*55)
print("All 15 tables loaded successfully!")
print("="*55)