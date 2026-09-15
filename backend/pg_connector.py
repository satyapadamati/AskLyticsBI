# pg_connector.py
# PostgreSQL connector — replaces snowflake_connector.py
# Same function signatures so main.py needs minimal changes
 
import os
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv()
 
PG_HOST   = os.getenv("PG_HOST",    "localhost")
PG_PORT   = int(os.getenv("PG_PORT", 5432))
PG_DB     = os.getenv("PG_DATABASE","gen_bi_agent_db")
PG_USER   = os.getenv("PG_USER",    "postgres")
PG_PASS   = os.getenv("PG_PASSWORD","")
PG_SCHEMA = os.getenv("PG_SCHEMA",  "final")
PG_TABLE  = os.getenv("PG_TABLE",   "company_x_final_table")
FTBL      = f"{PG_SCHEMA}.{PG_TABLE}"
 
 
def get_connection():
    """Get a new PostgreSQL connection."""
    return psycopg2.connect(
        host    = PG_HOST,
        port    = PG_PORT,
        dbname  = PG_DB,
        user    = PG_USER,
        password= PG_PASS,
        connect_timeout=10,
    )
 
 
def test_connection():
    """Test connection — same signature as Snowflake version."""
    try:
        conn   = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return True, f"PostgreSQL connected: {version[:40]}"
    except Exception as e:
        return False, f"Connection failed: {str(e)}"
 
 
def run_query(sql: str):
    """
    Execute SQL and return (DataFrame, error_message).
    Same signature as Snowflake version.
    PostgreSQL uses %s placeholders, not :param.
    """
    conn   = None
    cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(sql)
        rows    = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        df      = pd.DataFrame(rows, columns=columns)
        # Uppercase column names to match Snowflake behaviour
        df.columns = [c.upper() for c in df.columns]
        return df, None
    except Exception as e:
        return None, str(e)
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()
 
 
def get_table_schema():
    """Return column names and types — same as Snowflake version."""
    sql = f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = '{PG_SCHEMA}'
          AND table_name   = '{PG_TABLE}'
        ORDER BY ordinal_position
    """
    df, err = run_query(sql)
    if err or df is None or df.empty:
        return f"Error fetching schema: {err}"
    lines = [f"{r['COLUMN_NAME']}: {r['DATA_TYPE']}"
             for _, r in df.iterrows()]
    return "\n".join(lines)