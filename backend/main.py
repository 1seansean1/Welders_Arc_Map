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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import asyncio
import json
import sqlite3
import hashlib
from pathlib import Path


DB_PATH = Path(__file__).parent / "wa_map.db"


def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT, role TEXT DEFAULT 'user', created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS profile_settings (profile_id INTEGER PRIMARY KEY, settings_json TEXT DEFAULT '{}', updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE)""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, permissions TEXT DEFAULT '[]', description TEXT)""")
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


app = FastAPI(title="Satellite Visualization API", description="Real-time satellite tracking and orbital mechanics", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

static_dir = Path(__file__).parent.parent / "static"
templates_dir = Path(__file__).parent.parent / "templates"
static_dir.mkdir(exist_ok=True)
templates_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.on_event("startup")
async def startup_event():
    init_database()

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
    cursor.execute(f"UPDATE profiles SET {' '.join(updates)} WHERE id = ?", values)
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
async def login(body: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    password_hash = hashlib.sha256(body.password.encode()).hexdigest()
    cursor.execute("SELECT id, username, display_name, role FROM profiles WHERE username = ? AND password_hash = ?", (body.username, password_hash))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful", "profile": dict(row)}

@app.post("/api/auth/logout")
async def logout():
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
        ids = [int(x.strip()) for x in norad_ids.split(',')]
        positions = [s for s in SATELLITES if s['noradId'] in ids]
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
    print("Starting Satellite Visualization Server")
    print("API: http://localhost:8000")
    print("Docs: http://localhost:8000/docs")
    print("WebSocket: ws://localhost:8000/ws/realtime")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")