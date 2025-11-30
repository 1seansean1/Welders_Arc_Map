"""
Satellite Visualization System - Backend API
FastAPI server for satellite tracking, orbital mechanics, and data management

PERFORMANCE TARGETS:
- API response: <100ms (p95)
- SGP4 propagation: <50ms for 1000 satellites
- WebSocket updates: 1-5 Hz (adaptive)

MOBILE COMPATIBILITY:
- CORS enabled for cross-origin requests
- Lightweight JSON responses
- WebSocket support for real-time updates
- Adaptive update rates based on client capability
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import asyncio
import json
import sqlite3
import hashlib
import time
import structlog
from pathlib import Path


# Configure structlog for structured logging
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

slog = structlog.get_logger("wa_map")


# Log retention period (48 hours)
LOG_RETENTION_HOURS = 48


DB_PATH = Path(__file__).parent / "wa_map.db"


def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def log_event(level: str, category: str, message: str, profile_id = None,
              username = None, endpoint = None,
              method = None, request_body = None,
              response_status = None, duration_ms = None):
    """Log an event to the system_logs table with profile context."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO system_logs (timestamp, profile_id, username, level, category,
                                 endpoint, method, message, request_body, response_status, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.utcnow().isoformat(),
        profile_id,
        username or 'anonymous',
        level,
        category,
        endpoint,
        method,
        message,
        request_body,
        response_status,
        duration_ms
    ))
    conn.commit()
    conn.close()

    # Also log to structlog for console output
    slog.info(message, level=level, category=category, profile_id=profile_id,
              username=username, endpoint=endpoint, method=method,
              response_status=response_status, duration_ms=duration_ms)


def cleanup_old_logs():
    """Delete logs older than LOG_RETENTION_HOURS (48 hours)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cutoff = (datetime.utcnow() - timedelta(hours=LOG_RETENTION_HOURS)).isoformat()
    cursor.execute("DELETE FROM system_logs WHERE timestamp < ?", (cutoff,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    if deleted > 0:
        slog.info(f"Cleaned up {deleted} old log entries", category="SYSTEM", deleted_count=deleted)
    return deleted


def init_database():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT, role TEXT DEFAULT 'user', created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS profile_settings (profile_id INTEGER PRIMARY KEY, settings_json TEXT DEFAULT '{}', updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE)""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, permissions TEXT DEFAULT '[]', description TEXT)""")

    # Create system_logs table for 48-hour log retention
    cursor.execute("""CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        profile_id INTEGER,
        username TEXT DEFAULT 'anonymous',
        level TEXT NOT NULL,
        category TEXT,
        endpoint TEXT,
        method TEXT,
        message TEXT NOT NULL,
        request_body TEXT,
        response_status INTEGER,
        duration_ms REAL,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
    )""")

    # Create index for efficient cleanup and queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_logs_profile_id ON system_logs(profile_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)")

    cursor.execute("""INSERT OR IGNORE INTO roles (name, permissions, description) VALUES ('admin', '["read", "write", "delete", "admin"]', 'Full system access'), ('user', '["read", "write"]', 'Standard user access'), ('viewer', '["read"]', 'Read-only access')""")
    cursor.execute("SELECT COUNT(*) FROM profiles")
    if cursor.fetchone()[0] == 0:
        default_hash = hashlib.sha256("default".encode()).hexdigest()
        cursor.execute("INSERT INTO profiles (username, password_hash, display_name, role) VALUES ('default', ?, 'Default User', 'user')", (default_hash,))
        profile_id = cursor.lastrowid
        default_settings = json.dumps({"mapCenter": [0, 0], "mapZoom": 2, "selectedSatellites": [], "selectedSensors": [], "watchlists": [], "uiPreferences": {"panelExpanded": True, "activeSection": "satellites", "theme": "dark"}, "timeSettings": {"tailMinutes": 45, "headMinutes": 0, "glowEnabled": True, "glowIntensity": 1.0, "apexTickEnabled": True}})
        cursor.execute("INSERT INTO profile_settings (profile_id, settings_json) VALUES (?, ?)", (profile_id, default_settings))
    conn.commit()
    conn.close()
    print("Database initialized successfully")


class ProfileCreate(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None

class ProfileSettings(BaseModel):
    settings: Dict[str, Any]

class LoginRequest(BaseModel):
    username: str
    password: str


# Logging middleware to capture all requests
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Extract profile info from header (set by frontend after login)
        profile_id = request.headers.get("X-Profile-ID")
        username = request.headers.get("X-Username", "anonymous")

        # Get request body for POST/PUT (limit size for logging)
        request_body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                request_body = body.decode("utf-8")[:1000] if body else None
            except:
                pass

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Determine log level based on status code
        if response.status_code >= 500:
            level = "error"
        elif response.status_code >= 400:
            level = "warning"
        else:
            level = "info"

        # Skip logging for static files and health checks to reduce noise
        path = request.url.path
        if not path.startswith("/static") and path != "/api/health":
            log_event(
                level=level,
                category="API",
                message=f"{request.method} {path}",
                profile_id=int(profile_id) if profile_id and profile_id.isdigit() else None,
                username=username,
                endpoint=path,
                method=request.method,
                request_body=request_body,
                response_status=response.status_code,
                duration_ms=round(duration_ms, 2)
            )

        return response


app = FastAPI(title="Satellite Visualization API", description="Real-time satellite tracking and orbital mechanics", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(LoggingMiddleware)

static_dir = Path(__file__).parent.parent / "static"
templates_dir = Path(__file__).parent.parent / "templates"
static_dir.mkdir(exist_ok=True)
templates_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# Background task for periodic log cleanup
async def periodic_log_cleanup():
    """Run log cleanup every hour."""
    while True:
        await asyncio.sleep(3600)  # 1 hour
        cleanup_old_logs()


@app.on_event("startup")
async def startup_event():
    init_database()
    cleanup_old_logs()  # Clean up old logs on startup
    asyncio.create_task(periodic_log_cleanup())  # Start periodic cleanup
    log_event("info", "SYSTEM", "Server started", endpoint="/", method="STARTUP")

@app.get("/", response_class=HTMLResponse)
async def serve_app():
    html_file = templates_dir / "index.html"
    if html_file.exists():
        return FileResponse(html_file)
    return HTMLResponse(content="<h1>Satellite Visualization System</h1><p>Frontend not found</p>")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "version": "1.0.0"}

@app.get("/api/time/now")
async def get_current_time():
    return {"utc": datetime.utcnow().isoformat(), "unix": datetime.utcnow().timestamp()}


# System logs endpoint
@app.get("/api/logs")
async def get_logs(
    limit: int = 100,
    offset: int = 0,
    profile_id: Optional[int] = None,
    level: Optional[str] = None,
    category: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None
):
    """Query system logs with optional filters. Logs are retained for 48 hours."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM system_logs WHERE 1=1"
    params = []

    if profile_id is not None:
        query += " AND profile_id = ?"
        params.append(profile_id)
    if level:
        query += " AND level = ?"
        params.append(level)
    if category:
        query += " AND category = ?"
        params.append(category)
    if since:
        query += " AND timestamp >= ?"
        params.append(since)
    if until:
        query += " AND timestamp <= ?"
        params.append(until)

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    logs = [dict(row) for row in cursor.fetchall()]

    # Get total count
    count_query = "SELECT COUNT(*) FROM system_logs WHERE 1=1"
    count_params = []
    if profile_id is not None:
        count_query += " AND profile_id = ?"
        count_params.append(profile_id)
    if level:
        count_query += " AND level = ?"
        count_params.append(level)
    if category:
        count_query += " AND category = ?"
        count_params.append(category)
    if since:
        count_query += " AND timestamp >= ?"
        count_params.append(since)
    if until:
        count_query += " AND timestamp <= ?"
        count_params.append(until)

    cursor.execute(count_query, count_params)
    total = cursor.fetchone()[0]

    conn.close()
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset,
        "retention_hours": LOG_RETENTION_HOURS
    }


@app.delete("/api/logs")
async def clear_logs(before: Optional[str] = None):
    """Clear logs. If 'before' timestamp provided, only clears logs before that time."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if before:
        cursor.execute("DELETE FROM system_logs WHERE timestamp < ?", (before,))
    else:
        cursor.execute("DELETE FROM system_logs")

    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    log_event("info", "SYSTEM", f"Cleared {deleted} log entries", endpoint="/api/logs", method="DELETE")
    return {"message": f"Deleted {deleted} log entries", "deleted": deleted}


@app.get("/api/profiles")
async def list_profiles():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, display_name, role, created_at FROM profiles")
    profiles = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"profiles": profiles}

@app.get("/api/profiles/{profile_id}")
async def get_profile(profile_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, display_name, role, created_at FROM profiles WHERE id = ?", (profile_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dict(row)

@app.post("/api/profiles")
async def create_profile(profile: ProfileCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    password_hash = hashlib.sha256(profile.password.encode()).hexdigest()
    try:
        cursor.execute("INSERT INTO profiles (username, password_hash, display_name) VALUES (?, ?, ?)", (profile.username, password_hash, profile.display_name or profile.username))
        profile_id = cursor.lastrowid
        default_settings = json.dumps({"mapCenter": [0, 0], "mapZoom": 2, "selectedSatellites": [], "selectedSensors": [], "watchlists": [], "uiPreferences": {"panelExpanded": True, "activeSection": "satellites", "theme": "dark"}, "timeSettings": {"tailMinutes": 45, "headMinutes": 0, "glowEnabled": True, "glowIntensity": 1.0, "apexTickEnabled": True}})
        cursor.execute("INSERT INTO profile_settings (profile_id, settings_json) VALUES (?, ?)", (profile_id, default_settings))
        conn.commit()
        conn.close()
        log_event("info", "AUTH", f"Profile created: {profile.username}", profile_id=profile_id, username=profile.username)
        return {"id": profile_id, "username": profile.username, "message": "Profile created"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")


@app.put("/api/profiles/{profile_id}")
async def update_profile(profile_id: int, profile: ProfileUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    updates, values = [], []
    if profile.display_name is not None:
        updates.append("display_name = ?")
        values.append(profile.display_name)
    if profile.password is not None:
        updates.append("password_hash = ?")
        values.append(hashlib.sha256(profile.password.encode()).hexdigest())
    if profile.role is not None:
        updates.append("role = ?")
        values.append(profile.role)
    if not updates:
        conn.close()
        raise HTTPException(status_code=400, detail="No updates provided")
    values.append(profile_id)
    cursor.execute(f"UPDATE profiles SET {', '.join(updates)} WHERE id = ?", values)
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Profile not found")
    conn.commit()
    conn.close()
    return {"message": "Profile updated"}

@app.delete("/api/profiles/{profile_id}")
async def delete_profile(profile_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM profiles")
    if cursor.fetchone()[0] <= 1:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot delete the last profile")
    cursor.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Profile not found")
    conn.commit()
    conn.close()
    return {"message": "Profile deleted"}

@app.get("/api/profiles/{profile_id}/settings")
async def get_profile_settings(profile_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT settings_json, updated_at FROM profile_settings WHERE profile_id = ?", (profile_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Settings not found")
    return {"profile_id": profile_id, "settings": json.loads(row["settings_json"]), "updated_at": row["updated_at"]}

@app.put("/api/profiles/{profile_id}/settings")
async def update_profile_settings(profile_id: int, body: ProfileSettings):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM profiles WHERE id = ?", (profile_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Profile not found")
    settings_json = json.dumps(body.settings)
    cursor.execute("INSERT OR REPLACE INTO profile_settings (profile_id, settings_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", (profile_id, settings_json))
    conn.commit()
    conn.close()
    return {"message": "Settings updated", "profile_id": profile_id}


@app.post("/api/auth/login")
async def login(request: Request, body: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    password_hash = hashlib.sha256(body.password.encode()).hexdigest()
    cursor.execute("SELECT id, username, display_name, role FROM profiles WHERE username = ? AND password_hash = ?", (body.username, password_hash))
    row = cursor.fetchone()
    conn.close()
    if not row:
        log_event("warning", "AUTH", f"Failed login attempt for: {body.username}", username=body.username, endpoint="/api/auth/login", method="POST", response_status=401)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    profile = dict(row)
    log_event("info", "AUTH", f"User logged in: {body.username}", profile_id=profile["id"], username=body.username, endpoint="/api/auth/login", method="POST", response_status=200)
    return {"message": "Login successful", "profile": profile}

@app.post("/api/auth/logout")
async def logout(request: Request):
    profile_id = request.headers.get("X-Profile-ID")
    username = request.headers.get("X-Username", "anonymous")
    log_event("info", "AUTH", f"User logged out: {username}",
              profile_id=int(profile_id) if profile_id and profile_id.isdigit() else None,
              username=username, endpoint="/api/auth/logout", method="POST")
    return {"message": "Logged out"}

@app.get("/api/roles")
async def list_roles():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM roles")
    roles = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"roles": roles}


SATELLITES = []

@app.get("/api/satellites")
async def get_satellites(limit: int = 100, offset: int = 0):
    satellites = SATELLITES[offset:offset + limit]
    return {"total": len(SATELLITES), "limit": limit, "offset": offset, "satellites": satellites}

@app.get("/api/satellites/positions")
async def get_satellite_positions(time: Optional[str] = None, norad_ids: Optional[str] = None):
    target_time = datetime.fromisoformat(time) if time else datetime.utcnow()
    if norad_ids:
        ids = [int(x.strip()) for x in norad_ids.split(",")]
        positions = [s for s in SATELLITES if s["noradId"] in ids]
    else:
        positions = SATELLITES
    return {"time": target_time.isoformat(), "count": len(positions), "positions": positions}


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws/realtime")
async def websocket_realtime(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({"type": "connected", "message": "Real-time updates active"})
        while True:
            positions = {"type": "positions", "time": datetime.utcnow().isoformat(), "data": SATELLITES}
            await websocket.send_json(positions)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    import os
    print("Starting Satellite Visualization Server")
    print("API: http://localhost:8000")
    print("Docs: http://localhost:8000/docs")
    print("WebSocket: ws://localhost:8000/ws/realtime")
    # Change to backend directory for proper module resolution
    os.chdir(Path(__file__).parent)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
