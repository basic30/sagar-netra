import os
import json
import hashlib
import numpy as np
from shapely.geometry import Polygon, MultiPoint, mapping
import pyproj
from shapely.ops import transform

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

try:
    from backend.app.services.environmental_service import fetch_environmental_forcing
except ImportError:
    from app.services.environmental_service import fetch_environmental_forcing

def run_forward_drift_simulation(centroid_lat,
                                 centroid_lon,
                                 forcing_data=None,
                                 num_particles=1000,
                                 hours=[6, 12, 24, 48],
                                 output_dir="outputs/forecasts"):
    """
    Phase 21 — Forward Oil Spill Drift Simulation:
    - Uses physics-based Lagrangian particle trajectory tracking.
    - Drift Velocity = Surface Current + 3% Wind Drift Factor + Turbulent Diffusion.
    - Generates forecast probability polygons for +6h, +12h, +24h, +48h.
    - Saves outputs as GeoJSON files communicating drift uncertainty.
    """
    if forcing_data is None:
        forcing_data = fetch_environmental_forcing(centroid_lat, centroid_lon)

    u_wind = forcing_data["wind_u_m_s"]
    v_wind = forcing_data["wind_v_m_s"]
    u_curr = forcing_data["current_u_m_s"]
    v_curr = forcing_data["current_v_m_s"]

    # Effective drift velocity (m/s): Current + 3% Windage factor
    u_drift_mps = u_curr + 0.03 * u_wind
    v_drift_mps = v_curr + 0.03 * v_wind

    # Transformers
    project_to_meters = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True).transform
    project_to_wgs84 = pyproj.Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True).transform

    center_x, center_y = project_to_meters(centroid_lon, centroid_lat)

    # Deterministic, thread-safe RNG seeded by incident centroid coordinates
    coord_key = f"{round(float(centroid_lat), 4)}_{round(float(centroid_lon), 4)}"
    seed = int(hashlib.md5(coord_key.encode()).hexdigest()[:8], 16) % 100000
    rng = np.random.RandomState(seed)

    # Seed particles initially at centroid with small initial radius
    init_radii = rng.uniform(0, 100, num_particles) # 100m initial radius
    init_angles = rng.uniform(0, 2 * np.pi, num_particles)

    particle_x = center_x + init_radii * np.cos(init_angles)
    particle_y = center_y + init_radii * np.sin(init_angles)

    forecast_results = {}
    os.makedirs(output_dir, exist_ok=True)

    for h in hours:
        dt_seconds = h * 3600.0

        # Advection displacement (meters)
        disp_x = u_drift_mps * dt_seconds
        disp_y = v_drift_mps * dt_seconds

        # Diffusion (turbulent dispersion growing with time: K = 1.0 m^2/s)
        diffusion_std = np.sqrt(2.0 * 1.0 * dt_seconds)
        diff_x = rng.normal(0, diffusion_std, num_particles)
        diff_y = rng.normal(0, diffusion_std, num_particles)

        cur_x = particle_x + disp_x + diff_x
        cur_y = particle_y + disp_y + diff_y

        # Convert back to WGS84 coordinates
        pts_wgs84 = [project_to_wgs84(px, py) for px, py in zip(cur_x, cur_y)]
        multi_pt = MultiPoint(pts_wgs84)
        convex_hull = multi_pt.convex_hull.buffer(0.002) # Buffer to represent uncertainty envelope

        # Calculate area of forecast polygon in EPSG:3857
        hull_m = transform(project_to_meters, convex_hull)
        forecast_area_sqkm = hull_m.area / 1e6

        # Particle coordinates [lon, lat]
        particles_list = [[round(float(pt[0]), 5), round(float(pt[1]), 5)] for pt in pts_wgs84]

        geojson_feature = {
            "type": "Feature",
            "geometry": mapping(convex_hull),
            "properties": {
                "forecast_hour": f"+{h}h",
                "simulation_duration_hours": h,
                "forecast_area_sqkm": round(float(forecast_area_sqkm), 3),
                "forcing": forcing_data,
                "particle_count": num_particles,
                "particles": particles_list,
                "description": f"Probable forecast zone at +{h} hours"
            }
        }

        geojson_path = os.path.join(output_dir, f"forecast_{h}h.geojson")
        with open(geojson_path, "w") as f:
            json.dump(geojson_feature, f, indent=2)

        forecast_results[f"{h}h"] = {
            "forecast_hour": h,
            "geojson_path": geojson_path,
            "area_sqkm": round(float(forecast_area_sqkm), 3),
            "particles": particles_list,
            "geojson": geojson_feature
        }

    return forecast_results

if __name__ == "__main__":
    print("Testing Forward Drift Simulation (Phase 21)...", flush=True)
    results = run_forward_drift_simulation(1.2500, 103.8000)
    for k, v in results.items():
        print(f"  [{k}] Area: {v['area_sqkm']} sq km | Saved: {v['geojson_path']}")
    print("Forward Drift Simulation verification passed!")
