import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class IncidentModel(Base):
    __tablename__ = "incidents"

    incident_id = Column(String, primary_key=True, index=True)
    detection_time = Column(DateTime, default=datetime.datetime.utcnow)
    source_image = Column(String, nullable=False)
    confidence = Column(Float, default=0.765)
    spill_area_sqkm = Column(Float, nullable=False)
    centroid_lat = Column(Float, nullable=False)
    centroid_lon = Column(Float, nullable=False)
    geometry_geojson = Column(JSON, nullable=False)
    status = Column(String, default="Active")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "incident_id": self.incident_id,
            "detection_time": self.detection_time.isoformat() if self.detection_time else None,
            "source_image": self.source_image,
            "confidence": self.confidence,
            "spill_area_sqkm": self.spill_area_sqkm,
            "centroid": [self.centroid_lat, self.centroid_lon],
            "geometry": self.geometry_geojson,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
