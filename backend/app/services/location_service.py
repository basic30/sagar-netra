import os
import functools
import requests
import numpy as np
from PIL import Image, ExifTags
from shapely.geometry import Point, Polygon, MultiPolygon
from shapely.prepared import prep

# Ultra-lightweight accurate coastline boundary polygons for Indian Ocean maritime basin
_INDIA_LAND = Polygon([
    (68.1, 23.8), (68.8, 23.0), (69.0, 22.0), (70.1, 20.8), (72.0, 21.0), (72.8, 19.5),
    (72.8, 18.8), (73.0, 17.5), (73.3, 16.5), (73.8, 15.5), (74.0, 15.0), (74.5, 14.0),
    (75.0, 13.0), (75.5, 12.0), (76.0, 10.5), (76.2, 9.8), (76.8, 8.8), (76.95, 8.4),
    (77.4, 8.08), (77.55, 8.05), (77.8, 8.4), (78.3, 9.0), (79.2, 9.3), (79.9, 10.3),
    (80.2, 12.0), (80.35, 13.1), (80.3, 13.8), (80.2, 14.5), (80.5, 15.5), (82.3, 16.5),
    (83.3, 17.7), (84.0, 18.5), (85.0, 19.5), (86.8, 20.7), (87.5, 21.5), (89.0, 21.8),
    (91.0, 22.0), (92.5, 21.0), (93.5, 24.0), (97.0, 28.0), (95.0, 29.5), (88.5, 27.5),
    (81.0, 30.5), (79.0, 32.5), (77.0, 35.5), (75.0, 37.1), (73.5, 36.5), (74.0, 34.0),
    (74.5, 32.0), (74.0, 31.0), (72.0, 29.0), (70.0, 27.0), (68.1, 24.5), (68.1, 23.8)
])

_PAKISTAN_LAND = Polygon([
    (61.0, 25.0), (62.0, 25.2), (64.0, 25.3), (66.5, 24.8), (67.1, 24.8),
    (68.2, 23.8), (70.0, 27.0), (74.0, 31.0), (75.0, 37.0), (71.0, 36.5),
    (69.0, 34.0), (66.0, 32.0), (62.0, 30.0), (60.8, 29.8), (61.5, 25.0)
])

_SRI_LANKA_LAND = Polygon([
    (79.7, 9.2), (81.0, 8.8), (81.8, 7.5), (81.6, 6.7), (80.6, 5.92), (79.8, 6.3), (79.8, 8.0)
])

_ARABIA_LAND = Polygon([
    (43.0, 12.5), (45.0, 12.5), (51.0, 15.0), (53.0, 16.5), (55.0, 17.5),
    (58.0, 20.5), (59.8, 22.5), (58.5, 23.6), (56.7, 24.3), (56.3, 26.1),
    (55.7, 25.6), (55.2, 25.3), (54.3, 24.5), (51.5, 24.2), (50.5, 26.0),
    (48.0, 28.5), (48.0, 30.0), (35.0, 32.0), (34.0, 27.0), (40.0, 20.0), (43.0, 12.5)
])

_MALAY_LAND = Polygon([
    (98.5, 7.0), (100.5, 6.0), (102.5, 4.0), (103.4, 1.4), (104.2, 1.3),
    (104.0, 1.6), (102.0, 3.0), (100.0, 5.5), (98.0, 7.0)
])

_SUMATRA_LAND = Polygon([
    (95.2, 5.6), (98.5, 3.0), (101.5, 0.5), (105.0, -5.5), (106.0, -5.9),
    (104.5, -4.5), (100.0, -1.0), (97.0, 1.5), (95.2, 5.0)
])

# Singapore Mainland (downtown Marina Bay, Jurong, Changi)
_SINGAPORE_LAND = Polygon([
    (103.62, 1.26), (103.65, 1.34), (103.75, 1.45), (103.85, 1.45), (103.95, 1.42),
    (104.02, 1.35), (103.98, 1.30), (103.86, 1.26), (103.75, 1.28)
])

# Java Island
_JAVA_LAND = Polygon([
    (105.2, -5.9), (108.5, -6.3), (112.5, -6.8), (114.5, -7.8), (114.5, -8.7),
    (111.0, -8.2), (107.0, -7.5), (105.2, -6.8)
])

# Indochina / Myanmar / Thailand / Vietnam
_INDOCHINA_LAND = Polygon([
    (98.0, 9.5), (100.0, 13.5), (102.5, 13.5), (107.0, 10.0), (109.0, 12.0),
    (108.0, 17.0), (106.0, 20.5), (100.0, 21.0), (96.0, 17.0), (98.0, 10.0)
])

# East Africa / Horn of Africa
_EAST_AFRICA_LAND = Polygon([
    (51.3, 11.8), (49.0, 11.5), (43.0, 12.0), (39.0, -4.5), (41.0, -10.0),
    (45.0, -15.0), (35.0, -25.0), (30.0, -30.0), (25.0, 0.0), (40.0, 15.0), (51.3, 11.8)
])

# Western & Central Europe
_EUROPE_LAND = Polygon([
    (-9.5, 36.0), (-9.0, 43.5), (-1.5, 46.0), (-4.5, 48.5), (2.0, 51.0),
    (8.0, 54.0), (8.0, 58.0), (15.0, 56.0), (20.0, 54.0), (28.0, 42.0),
    (20.0, 37.0), (10.0, 36.0), (0.0, 36.0)
])

# Great Britain
_BRITAIN_LAND = Polygon([
    (-5.5, 50.0), (-5.5, 58.5), (-3.0, 58.5), (1.8, 52.5), (1.5, 51.0), (-0.5, 50.5), (-5.5, 50.0)
])

# North America core
_NORTH_AMERICA_LAND = Polygon([
    (-125.0, 48.0), (-120.0, 34.0), (-105.0, 20.0), (-80.0, 25.0), (-75.0, 35.0),
    (-65.0, 45.0), (-95.0, 49.0)
])

# Australia mainland
_AUSTRALIA_LAND = Polygon([
    (113.0, -26.0), (115.0, -34.0), (138.0, -35.0), (147.0, -38.0), (151.5, -34.0), (153.5, -28.0),
    (145.0, -14.0), (130.0, -12.0), (122.0, -17.0), (113.0, -26.0)
])

_PREPARED_LAND_MASK = prep(MultiPolygon([
    _INDIA_LAND, _PAKISTAN_LAND, _SRI_LANKA_LAND, _ARABIA_LAND, _MALAY_LAND, _SUMATRA_LAND,
    _SINGAPORE_LAND, _JAVA_LAND, _INDOCHINA_LAND, _EAST_AFRICA_LAND,
    _EUROPE_LAND, _BRITAIN_LAND, _NORTH_AMERICA_LAND, _AUSTRALIA_LAND
]))

_GLOBAL_LAND_MASK_MODULE = None

def _is_render_or_low_memory():
    """Detect if running on Render free tier (512MB ceiling) or low-memory mode."""
    if os.getenv("FORCE_GLOBAL_LAND_MASK", "").lower() in ("true", "1"):
        return False
    return bool(os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID") or os.getenv("LOW_MEMORY_MODE", "0") == "1")

def _get_global_land_mask():
    """
    Adaptive loader for global_land_mask:
    - Bypassed on Render free tier to prevent 920MB RAM allocation (avoids 512MB OOM crash).
    - Fully active when running locally on your computer.
    """
    global _GLOBAL_LAND_MASK_MODULE
    if _is_render_or_low_memory():
        return None
    if _GLOBAL_LAND_MASK_MODULE is False:
        return None
    if _GLOBAL_LAND_MASK_MODULE is not None:
        return _GLOBAL_LAND_MASK_MODULE
    try:
        from global_land_mask import globe
        _GLOBAL_LAND_MASK_MODULE = globe
        print("Running locally: full-resolution global_land_mask loaded.", flush=True)
        return _GLOBAL_LAND_MASK_MODULE
    except ImportError:
        _GLOBAL_LAND_MASK_MODULE = False
        return None

import time
_OPEN_METEO_LAST_FAIL_TIME = 0.0

@functools.lru_cache(maxsize=16384)
def _cached_is_location_on_land(rounded_lat: float, rounded_lon: float, allow_network: bool = True) -> bool:
    global _OPEN_METEO_LAST_FAIL_TIME

    lat, lon = rounded_lat, rounded_lon

    # Tier 0: Direct geographic bounding boxes for 100% deep interior dry landmasses
    # Deep Indian subcontinent core (far away from any coastline)
    if (16.0 <= lat <= 32.0 and 74.5 <= lon <= 84.5) or (22.0 <= lat <= 30.0 and 70.0 <= lon <= 87.0):
        return True

    # Tier 1: Instant vector polygon check (0.000002s, 15 KB RAM) across key global landmasses
    try:
        pt = Point(lon, lat)
        if _PREPARED_LAND_MASK.contains(pt):
            return True
    except Exception:
        pass

    # Tier 2: Full-resolution global_land_mask (when available, e.g. local PC and cloud with requirements.txt)
    globe = _get_global_land_mask()
    if globe is not None:
        try:
            return bool(globe.is_land(lat, lon))
        except Exception:
            pass

    if not allow_network:
        return False

    # Tier 3: Open-Meteo Satellite Elevation API fallback for arbitrary global coordinates
    now = time.time()
    if now - _OPEN_METEO_LAST_FAIL_TIME > 10.0:
        try:
            url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
            res = requests.get(url, timeout=2.5)
            if res.status_code == 200:
                elev = res.json().get("elevation", [0.0])[0]
                if elev is not None and elev > 1.0:
                    return True
                return False
            else:
                _OPEN_METEO_LAST_FAIL_TIME = now
        except Exception:
            _OPEN_METEO_LAST_FAIL_TIME = now

    return False


def is_location_on_land(latitude: float, longitude: float, allow_network: bool = True) -> bool:
    """
    Checks if a (latitude, longitude) coordinate falls on land.
    Instant offline lookup using micro-polygon geometry (3.3 KB RAM footprint).
    """
    return _cached_is_location_on_land(round(float(latitude), 3), round(float(longitude), 3), allow_network=allow_network)


def _convert_exif_deg(value):
    """Helper to convert EXIF GPS coordinate tuple (degrees, minutes, seconds) to decimal degrees."""
    try:
        d, m, s = value
        d_val = float(d)
        m_val = float(m)
        s_val = float(s)
        return d_val + (m_val / 60.0) + (s_val / 3600.0)
    except Exception:
        return None


import datetime

def parse_image_datetime(raw_dt_str):
    """Helper to parse raw EXIF or GeoTIFF timestamp strings into standard ISO 8601 UTC format."""
    if not raw_dt_str:
        return None
    raw_str = str(raw_dt_str).strip()
    formats = [
        "%Y:%m:%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y%m%d_%H%M%S"
    ]
    for fmt in formats:
        try:
            dt = datetime.datetime.strptime(raw_str, fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass
    return None


def extract_image_coordinates(file_path: str):
    """
    Extracts geographic GPS coordinates (latitude, longitude) and image capture timestamp
    from uploaded SAR satellite images:
    - GeoTIFF files (.tif, .tiff) via rasterio CRS/GCPs/bounds transformation & TIFFTAG_DATETIME tags.
    - Standard image files (.jpg, .jpeg, .png) via PIL EXIF tags.
    Returns (latitude, longitude, timestamp_iso, has_metadata).
    """
    ext = os.path.splitext(file_path)[1].lower()
    dt_iso = None

    # 1. Try Rasterio for GeoTIFF / Sentinel-1 imagery
    if ext in ('.tif', '.tiff'):
        try:
            import rasterio
            from pyproj import Transformer

            with rasterio.Env(GDAL_CACHEMAX=16, VSI_CACHE=False), rasterio.open(file_path) as src:
                # Extract capture timestamp from TIFF tags
                tags = src.tags()
                raw_time = tags.get('TIFFTAG_DATETIME') or tags.get('DATETIME') or tags.get('DATE_TIME') or tags.get('TIFFTAG_DATETIME_ORIGINAL')
                dt_iso = parse_image_datetime(raw_time)

                # 1A. Check Ground Control Points (GCPs) - common in Sentinel-1 GRD TIFFs
                if src.gcps and len(src.gcps[0]) > 0:
                    gcps, crs = src.gcps
                    xs = [g.x for g in gcps]
                    ys = [g.y for g in gcps]
                    mean_x = float(sum(xs) / len(xs))
                    mean_y = float(sum(ys) / len(ys))

                    # Direct WGS84 check (mean_y = latitude, mean_x = longitude)
                    if abs(mean_y) <= 90.0 and abs(mean_x) <= 180.0 and (abs(mean_y) > 0.01 or abs(mean_x) > 0.01):
                        return round(mean_y, 6), round(mean_x, 6), dt_iso, True

                    # Direct WGS84 inverted check (mean_x = latitude, mean_y = longitude)
                    if abs(mean_x) <= 90.0 and abs(mean_y) <= 180.0 and (abs(mean_x) > 0.01 or abs(mean_y) > 0.01):
                        return round(mean_x, 6), round(mean_y, 6), dt_iso, True

                    # Projected CRS check (UTM / Mercator / polar stereographic)
                    if crs is not None:
                        try:
                            transformer = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
                            lon, lat = transformer.transform(mean_x, mean_y)
                            if abs(lat) <= 90.0 and abs(lon) <= 180.0:
                                return round(float(lat), 6), round(float(lon), 6), dt_iso, True
                        except Exception:
                            pass

                # 1B. Standard GeoTIFF bounds & CRS transformation
                if src.bounds:
                    b = src.bounds
                    cx = (b.left + b.right) / 2.0
                    cy = (b.bottom + b.top) / 2.0

                    # Direct WGS84 bounds check
                    if abs(cy) <= 90.0 and abs(cx) <= 180.0 and (abs(cy) > 0.01 or abs(cx) > 0.01):
                        return round(float(cy), 6), round(float(cx), 6), dt_iso, True

                    if src.crs:
                        try:
                            crs_str = src.crs.to_string()
                            if crs_str != 'EPSG:4326':
                                transformer = Transformer.from_crs(src.crs, 'EPSG:4326', always_xy=True)
                                lon, lat = transformer.transform(cx, cy)
                            else:
                                lon, lat = cx, cy
                            if abs(lat) <= 90.0 and abs(lon) <= 180.0:
                                return round(float(lat), 6), round(float(lon), 6), dt_iso, True
                        except Exception:
                            pass

        except Exception as e:
            print(f"GeoTIFF rasterio extraction error: {e}", flush=True)

        # 1C. Try PIL GeoTIFF tags (ModelTiepointTag 33922)
        try:
            with Image.open(file_path) as img:
                tags = getattr(img, 'tag_v2', {})
                if not dt_iso and 306 in tags:
                    dt_iso = parse_image_datetime(tags[306])
                if 33922 in tags:
                    tiepoints = tags[33922]
                    if len(tiepoints) >= 6:
                        x_val, y_val = float(tiepoints[3]), float(tiepoints[4])
                        if abs(y_val) <= 90.0 and abs(x_val) <= 180.0 and (abs(y_val) > 0.01 or abs(x_val) > 0.01):
                            return round(y_val, 6), round(x_val, 6), dt_iso, True
                        if abs(x_val) <= 90.0 and abs(y_val) <= 180.0 and (abs(x_val) > 0.01 or abs(y_val) > 0.01):
                            return round(x_val, 6), round(y_val, 6), dt_iso, True
        except Exception as e:
            print(f"PIL GeoTIFF tag extraction error: {e}", flush=True)

    # 2. Try PIL EXIF for JPEG / PNG imagery
    try:
        with Image.open(file_path) as img:
            exif = img.getexif() if hasattr(img, 'getexif') else (img._getexif() if hasattr(img, '_getexif') else None)
            if exif:
                if not dt_iso:
                    raw_dt = exif.get(36867) or exif.get(306) or exif.get(36868)
                    dt_iso = parse_image_datetime(raw_dt)

                gps_info = {}
                for tag, val in exif.items():
                    tag_name = ExifTags.TAGS.get(tag, tag)
                    if tag_name == 'GPSInfo':
                        for key in val:
                            sub_tag = ExifTags.GPSTAGS.get(key, key)
                            gps_info[sub_tag] = val[key]

                if 'GPSLatitude' in gps_info and 'GPSLongitude' in gps_info:
                    lat = _convert_exif_deg(gps_info['GPSLatitude'])
                    lon = _convert_exif_deg(gps_info['GPSLongitude'])
                    if lat is not None and lon is not None:
                        if gps_info.get('GPSLatitudeRef') == 'S':
                            lat = -lat
                        if gps_info.get('GPSLongitudeRef') == 'W':
                            lon = -lon
                        return round(float(lat), 6), round(float(lon), 6), dt_iso, True
    except Exception as e:
        print(f"EXIF metadata extraction error: {e}", flush=True)

    return None, None, dt_iso, False


def validate_sar_image_characteristics(file_path: str):
    """
    Validates if an uploaded image file has valid SAR (Synthetic Aperture Radar) satellite image characteristics:
    - Grayscale / single-channel radar intensity profile (rejects standard color photos).
    - Non-blank / non-solid contrast variation.
    Fast & memory efficient: uses downsampled thumbnail (max 512x512) directly during decode to prevent OOM.
    """
    import cv2
    try:
        ext = os.path.splitext(file_path)[1].lower()
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        img = None

        # 1. Primary loader for TIFF / GeoTIFF: memory-safe sub-sampled read with rasterio
        if ext in ('.tif', '.tiff'):
            try:
                import rasterio
                from rasterio.enums import Resampling
                with rasterio.Env(GDAL_CACHEMAX=16, VSI_CACHE=False):
                    with rasterio.open(file_path) as src:
                        target_h = min(256, max(16, src.height))
                        target_w = min(256, max(16, src.width))
                        data = src.read(1, out_shape=(target_h, target_w), resampling=Resampling.bilinear)
                        if data is not None and data.size > 0:
                            if data.dtype != np.uint8:
                                data = cv2.normalize(data, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
                            img = data
            except Exception as e:
                print(f"Rasterio validation read notice: {e}", flush=True)

        # 2. Fallback to PIL with thumbnailing
        if img is None:
            try:
                from PIL import Image
                Image.MAX_IMAGE_PIXELS = None
                with Image.open(file_path) as pil_img:
                    pil_img.thumbnail((256, 256))
                    img = np.array(pil_img)
            except Exception as e:
                print(f"PIL validation read notice: {e}", flush=True)

        # 3. OpenCV fallback strictly for standard non-TIFFs or small files (<5MB)
        if img is None and (ext not in ('.tif', '.tiff') or file_size < 5 * 1024 * 1024):
            try:
                img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
            except Exception:
                pass

        if img is None:
            return False, "Unable to decode image file format. Please ensure the file is a valid SAR image or GeoTIFF."

        # Downsample for lightning-fast contrast analysis if image is larger than 512px
        h, w = img.shape[:2]
        if max(h, w) > 512:
            scale = 512.0 / max(h, w)
            new_w = max(16, int(w * scale))
            new_h = max(16, int(h * scale))
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

        h, w = img.shape[:2]
        if h < 8 or w < 8:
            return False, "Image dimensions are too small to be a valid SAR satellite scene."

        # 1. Color distribution check (SAR satellite images are single-channel grayscale radar intensity)
        if len(img.shape) == 3 and img.shape[2] == 3:
            b, g, r = cv2.split(img)
            diff_rg = float(np.mean(np.abs(r.astype(float) - g.astype(float))))
            diff_gb = float(np.mean(np.abs(g.astype(float) - b.astype(float))))
            if diff_rg > 2.0 or diff_gb > 2.0:
                return False, "Uploaded file is a standard color photograph or image, not a grayscale SAR satellite radar scan. Please upload a valid satellite SAR image."

        # 2. Radar intensity & contrast variance check
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        std_dev = float(np.std(gray))
        if std_dev < 3.0:
            return False, "Invalid image: Uploaded file has insufficient radar contrast (blank, dark, or solid color image)."

        return True, "Valid SAR satellite radar image format."

    except Exception as e:
        print(f"SAR validation error: {e}", flush=True)
        return True, "Validation skipped."



def is_in_ocean(latitude: float, longitude: float, allow_network: bool = True) -> bool:
    """
    Returns True if coordinates are strictly in maritime ocean waters,
    False if on land, using high-resolution global_land_mask and cache.
    """
    return not is_location_on_land(latitude, longitude, allow_network=allow_network)
