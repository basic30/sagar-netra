import os
import sys
from fastapi import APIRouter, Query

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
from backend.app.services.live_ais_service import get_live_vessels, get_connection_status
from backend.app.services.ais_service import get_full_ais_vessel_dataset

router = APIRouter(prefix="/vessels", tags=["Vessels"])

@router.get("/live")
def get_live_vessel_tracking():
    """Retrieve real-time AISstream live vessels."""
    vessels = get_live_vessels()
    status = get_connection_status()
    return {
        "status": status,
        "live_vessel_count": len(vessels),
        "vessels": vessels
    }

@router.get("/dataset")
def search_ais_vessel_dataset(
    search: str = Query(None, description="Search by name, MMSI, IMO, flag, destination"),
    ship_type: str = Query(None, description="Filter by ship type class")
):
    """Retrieve real AIS vessel dataset with optional search and type filtering."""
    vessels = get_full_ais_vessel_dataset(search=search, ship_type=ship_type)
    return {
        "total_count": len(vessels),
        "vessels": vessels
    }

