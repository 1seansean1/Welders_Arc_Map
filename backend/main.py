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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import List, Optional
import asyncio
import json
from pathlib import Path

app = FastAPI(
    title="Satellite Visualization API",
    description="Real-time satellite tracking and orbital mechanics",
    version="1.0.0"
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
static_dir = Path(__file__).parent.parent / "static"
templates_dir = Path(__file__).parent.parent / "templates"
static_dir.mkdir(exist_ok=True)
templates_dir.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/", response_class=HTMLResponse)
async def serve_app():
    """Serve the main application HTML"""
    html_file = templates_dir / "index.html"
    if html_file.exists():
        return FileResponse(html_file)
    return HTMLResponse(content="<h1>Satellite Visualization System</h1><p>Frontend not found</p>")


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


@app.get("/api/time/now")
async def get_current_time():
    """
    Get current UTC time

    MOBILE: Lightweight response, <1KB
    """
    return {
        "utc": datetime.utcnow().isoformat(),
        "unix": datetime.utcnow().timestamp()
    }


# Satellite data managed by frontend
# Backend will handle TLE propagation when implemented
SATELLITES = []


@app.get("/api/satellites")
async def get_satellites(limit: int = 100, offset: int = 0):
    """
    Get list of satellites

    PERFORMANCE: O(1) for mock data, O(n) when loading from DB
    MOBILE: Paginated to reduce payload size
    """
    # Satellites managed by frontend, returned empty for now
    satellites = SATELLITES[offset:offset + limit]

    return {
        "total": len(SATELLITES),
        "limit": limit,
        "offset": offset,
        "satellites": satellites
    }


@app.get("/api/satellites/positions")
async def get_satellite_positions(
    time: Optional[str] = None,
    norad_ids: Optional[str] = None
):
    """
    Get satellite positions at specific time

    Args:
        time: ISO format datetime (default: now)
        norad_ids: Comma-separated NORAD IDs (default: all)

    PERFORMANCE TARGET: <50ms for 1000 satellites
    BIG O: O(n) where n = number of satellites requested
    MOBILE: Use viewport-based queries to reduce data transfer
    """
    target_time = datetime.fromisoformat(time) if time else datetime.utcnow()

    # Parse NORAD IDs if provided
    if norad_ids:
        ids = [int(x.strip()) for x in norad_ids.split(',')]
        positions = [s for s in SATELLITES if s['noradId'] in ids]
    else:
        positions = SATELLITES

    # TODO: Implement actual SGP4 propagation
    # Frontend manages satellite data for now

    return {
        "time": target_time.isoformat(),
        "count": len(positions),
        "positions": positions
    }


# WebSocket connection manager
class ConnectionManager:
    """
    Manages WebSocket connections for real-time updates

    MOBILE: Supports adaptive update rates based on client bandwidth
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Broadcast to all connected clients"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                # Connection closed
                pass


manager = ConnectionManager()


@app.websocket("/ws/realtime")
async def websocket_realtime(websocket: WebSocket):
    """
    WebSocket endpoint for real-time satellite position updates

    PERFORMANCE: Adaptive update rate (1-5 Hz based on client)
    MOBILE: Lower update rate for mobile clients to save battery
    """
    await manager.connect(websocket)

    try:
        # Send initial data
        await websocket.send_json({
            "type": "connected",
            "message": "Real-time updates active"
        })

        # Update loop (1 Hz by default)
        while True:
            # Get current positions
            positions = {
                "type": "positions",
                "time": datetime.utcnow().isoformat(),
                "data": SATELLITES
            }

            await websocket.send_json(positions)
            await asyncio.sleep(1)  # 1 second interval

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

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )
