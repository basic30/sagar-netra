from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class IncidentSchema(BaseModel):
    incident_id: str
    detection_time: datetime
    source_image: str
    confidence: float
    spill_area_sqkm: float
    centroid_lat: float
    centroid_lon: float
    geometry_geojson: Dict[str, Any]
    status: str = "Active"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
