# 🌊 Garuda — Marine Oil Spill Detection, Lagrangian Drift & Vessel Attribution System

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-ee4c2c.svg?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.0%2B-61dafb.svg?logo=react&logoColor=white)](https://reactjs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9%2B-199900.svg?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An operational, end-to-end Geospatial Information System (GIS) platform for automated **marine oil spill detection** from Synthetic Aperture Radar (SAR) satellite imagery, **forward Lagrangian drift forecasting**, **backward probable origin tracing**, and **explainable multi-factor vessel attribution** using historical and real-time AIS marine telemetry.

--- 

## 📋 Table of Contents

- [Executive Overview](#-executive-overview)
- [System Architecture & Dataflow](#-system-architecture--dataflow)
- [Core Functional Modules](#-core-functional-modules)
- [Lagrangian Drift & Origin Tracing Physics](#-lagrangian-drift--origin-tracing-physics)
- [Explainable Vessel Attribution Algorithm](#-explainable-vessel-attribution-algorithm)
- [Project Directory Structure](#-project-directory-structure)
- [REST API Reference](#-rest-api-reference)
- [Installation & Quickstart Guide](#-installation--quickstart-guide)
- [Evaluation & Benchmark Results](#-evaluation--benchmark-results)
- [Deployment & Low-RAM Optimization](#-deployment--low-ram-optimization)
- [Scientific Limitations & Disclaimer](#-scientific-limitations--disclaimer)

---

## 🛡️ Executive Overview

Marine oil spills represent catastrophic environmental hazards requiring rapid response and strict legal accountability. **Garuda** bridges the gap between satellite remote sensing and maritime intelligence by providing:

1. **SAR Satellite Segmentation**: Deep learning-based extraction of slick boundaries from noise-heavy SAR backscatter images.
2. **Geospatial Physics Modeling**: Forward trajectory forecasting (+6h to +48h) and reverse origin backcasting (-24h) using real-time atmospheric wind and surface ocean currents.
3. **Automated Vessel Ranking**: Algorithmic cross-matching of probable origin zones against live and historical Automatic Identification System (AIS) ship tracks to pinpoint suspect polluters.

---

## 🏗️ System Architecture & Dataflow

The system integrates a high-performance **PyTorch ML engine**, a **FastAPI asynchronous backend**, an **AISstream WebSocket client**, and a dark-glassmorphic **React + Leaflet GIS frontend**.

### 1. High-Level System Architecture Diagram

```mermaid
graph TD
    %% Input Sources
    subgraph Inputs ["📡 Data Acquisition & Inputs"]
        A[SAR Satellite Imagery .tiff / .png]
        B[Real Environmental Forcing - Wind & Ocean Current APIs]
        C[Live AIS Telemetry - AISstream.io WebSockets]
        D[Historical Vessel Waypoint Logs]
    end

    %% Processing Core
    subgraph Backend ["⚡ Garuda FastAPI Backend Engine"]
        E[PyTorch SegFormer-B2 Model]
        F[Shapely & PyProj GIS Engine - EPSG:3857 Projection]
        G[Lagrangian Physics Simulator - Forward & Backward Drift]
        H[Multi-Factor Suspect Vessel Ranking Engine]
    end

    %% Outputs & UI
    subgraph Frontend ["🖥️ Garuda Interactive GIS Dashboard"]
        I[Leaflet Map Viewport - Dynamic Vector Layers]
        J[Backward Origin Zone & Target Envelope - Auto Camera Focus]
        K[Forward Forecast Timeline - +6h to +48h Animation]
        L[Explainable Vessel Suspect Scorecard & Audit Trail]
    end

    %% Pipeline Connections
    A --> E
    E --> F
    F --> G
    B --> G
    G --> H
    C --> H
    D --> H
    F --> I
    G --> K
    G --> J
    H --> L
```

---

### 2. Operational Processing Pipeline Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Operator as GIS Analyst / Operator
    participant FE as React Frontend
    participant BE as FastAPI Backend
    participant ML as PyTorch Model Engine
    participant Physics as Lagrangian Drift Engine
    participant AIS as Live AIS Service

    Operator->>FE: Upload SAR Image / Select Incident
    FE->>BE: POST /api/incidents/upload
    BE->>ML: Pass Tensor -> Run SegFormer-B2 Segmentation
    ML-->>BE: Binary Mask & Contour Polygons
    BE->>BE: Calculate EPSG:3857 Projected Area (km²)
    BE-->>FE: Return Incident Geometry & Metadata

    Operator->>FE: Click "Trace Origin (-24h)"
    FE->>BE: GET /api/incidents/{id}/origin
    BE->>Physics: Reverse Forcing Vector (- (v_curr + 3% v_wind))
    Physics-->>BE: Generate Probable Origin Polygon GeoJSON
    BE-->>FE: Return Origin GeoJSON
    FE->>FE: Auto-fit Map Viewport to Origin Envelope

    Operator->>FE: Request Vessel Ranking
    FE->>BE: GET /api/incidents/{id}/vessels
    BE->>AIS: Fetch Vessel Track History within Origin Window
    BE->>BE: Compute Multi-Factor Suspect Score S
    BE-->>FE: Ranked Vessel Suspect List + Transparent Audit Factors
```

---

## 🌟 Core Functional Modules

| Module | Technical Implementation | Key Output / Metric |
| :--- | :--- | :--- |
| **SAR Segmentation** | PyTorch SegFormer-B2 trained on satellite imagery | Binary masks & polygon boundaries |
| **Geodetic Calculations** | `Shapely` & `PyProj` re-projected to **EPSG:3857** | Projected spill area in square kilometers ($km^2$) |
| **Environmental Forcing** | Real-time atmospheric wind ($u_{10m}, v_{10m}$) and ocean current ($u_{\text{curr}}, v_{\text{curr}}$) vectors | Surface transport vector field |
| **Forward Drift Simulation** | Euler-Maruyama integration with turbulent diffusion | +6h, +12h, +24h, +48h forecast envelopes |
| **Backward Origin Simulation** | Reverse Lagrangian drift modeling (-24h window) | Yellow probable origin search envelope |
| **Explainable Attribution** | Multi-factor weighted scoring model | Ranked suspect vessels with score breakdown |
| **Live Telemetry Stream** | Secure WebSocket integration with `AISstream.io` | Real-time live marine traffic overlays |

---

## 🔬 Lagrangian Drift & Origin Tracing Physics

The particle drift simulator tracks oil slick movement on the sea surface using coupled advection-diffusion equations.

```mermaid
graph LR
    subgraph Forcing ["Environmental Forcing Vectors"]
        W["Wind Vector (v_wind)"]
        C["Current Vector (v_curr)"]
        D["Turbulent Diffusion (D_kh)"]
    end

    subgraph Equation ["Advection-Diffusion Model"]
        V["v_total = v_curr + 0.03 * v_wind"]
        P["dx = v_total * dt + sqrt(2 * D * dt) * N(0,1)"]
    end

    subgraph Output ["Envelopes"]
        Fwd["Forward Envelope (+6h..+48h)"]
        Bwd["Backward Origin Envelope (-24h)"]
    end

    W --> V
    C --> V
    V --> P
    D --> P
    P --> Fwd
    P --> Bwd
```

### Mathematical Formulation:
- **Total Advection Velocity**:
  $$\vec{v}_{\text{total}} = \vec{v}_{\text{current}} + 0.03 \cdot \vec{v}_{\text{wind}}$$
- **Reverse Origin Tracing Velocity**:
  $$\vec{v}_{\text{backward}} = -\left(\vec{v}_{\text{current}} + 0.03 \cdot \vec{v}_{\text{wind}}\right)$$
- **Particle Position Update**:
  $$\mathbf{x}_{t+\Delta t} = \mathbf{x}_t + \vec{v}_{\text{backward}} \Delta t + \sqrt{2 D_h \Delta t} \cdot \mathcal{N}(0, 1)$$

---

## ⚖️ Explainable Vessel Attribution Algorithm

Suspect vessels passing through the **Probable Origin Zone** are assigned a composite confidence score $S \in [0, 100\%]$ based on five transparent factors:

$$S_{\text{total}} = w_1 S_{\text{prox}} + w_2 S_{\text{temp}} + w_3 S_{\text{traj}} + w_4 S_{\text{behavior}} + w_5 S_{\text{gap}}$$

```mermaid
pie title Suspect Attribution Weight Distribution
    "Spatial Proximity (S_prox)" : 30
    "Temporal Coincidence (S_temp)" : 25
    "Trajectory Heading Alignment (S_traj)" : 20
    "Anomalous Speed Drop (S_behavior)" : 15
    "AIS Transponder Gap (S_gap)" : 10
```

---

## 📂 Project Directory Structure

```
c:\Users\snaha\Desktop\test/
├── backend/
│   └── app/
│       ├── main.py                     # FastAPI server entrypoint & lifespan events
│       ├── api/                        # REST API routers (incidents, vessels)
│       ├── services/
│       │   ├── backward_drift_service.py # Reverse Lagrangian origin tracing
│       │   ├── forward_drift_service.py  # Forward forecast timeline engine
│       │   ├── geometry_service.py      # Shapely polygon & area calculation
│       │   ├── live_ais_service.py      # AISstream.io WebSocket client
│       │   └── vessel_ranking_service.py # Multi-factor attribution scoring
│       ├── models/                     # SQLAlchemy Incident ORM models
│       └── schemas/                    # Pydantic request/response validation schemas
├── ml/
│   ├── src/
│   │   ├── train.py                    # PyTorch SegFormer-B2 training loop
│   │   ├── model.py                    # SegFormer-B2 segmentation model
│   │   ├── inference.py                # Post-processing & contour extraction
│   │   └── evaluate.py                 # Test set metric evaluation (IoU, Dice)
│   └── checkpoints/                    # Model weights (best_model.pth)
├── frontend/                           # React + Vite + Leaflet GIS Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapView.jsx             # Leaflet GIS canvas & camera controller
│   │   │   ├── ForecastPanel.jsx       # Origin & timeline metrics cards
│   │   │   ├── IncidentDetails.jsx     # Incident metadata panel
│   │   │   └── VesselRanking.jsx       # Explainable suspect scorecard
│   │   ├── App.jsx                     # Master Dashboard layout & tab routing
│   │   └── index.css                   # Glassmorphism design system & Tailwind CSS
├── outputs/                            # Generated GeoJSON polygons & envelopes
├── requirements.txt                    # Python environment dependencies
└── README.md                           # Documentation
```

---

## 🌐 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/incidents` | `GET` | Retrieve list of all detected oil spill incidents |
| `/api/incidents/all-geometry` | `GET` | MultiPolygon FeatureCollection of all recorded spills |
| `/api/incidents/upload` | `POST` | Upload SAR image file (`.png`, `.tiff`) for AI detection |
| `/api/incidents/{id}/origin` | `GET` | Run backward Lagrangian simulation & return origin GeoJSON |
| `/api/incidents/{id}/forecast` | `GET` | Generate +6h to +48h forward drift envelopes |
| `/api/incidents/{id}/vessels` | `GET` | Get ranked list of suspect vessels with audit factor breakdowns |
| `/api/vessels/live` | `GET` | Return live active vessels received via AISstream WebSocket |

---

## ⚡ Installation & Quickstart Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

### 1. Backend & Machine Learning Setup

```bash
# Navigate to workspace root
cd Sagar-Netra

# Install Python dependencies
pip install -r requirements.txt

# (Optional) Train or Evaluate ML Model
python ml/src/train.py
python ml/src/evaluate.py

# Start FastAPI Backend Server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Web Dashboard Setup

```bash
# Navigate to frontend folder
cd frontend

# Install Node modules
npm install

# Start Vite Development Server
npm run dev
```

Open `http://localhost:5173/` in your browser to launch the **Garuda** dashboard.

---

## 📊 Evaluation & Benchmark Results

The PyTorch SegFormer-B2 model was evaluated on the **complete, untouched test set** of satellite SAR imagery (1,211 scenes / 79,364,096 pixels) with zero batch truncation:

### 1. Scene-Level Segmentation Performance (Macro Average across 1,211 Test Scenes)
| Evaluation Metric | Benchmark Value | Operational Meaning |
| :--- | :---: | :--- |
| **Test Dataset Size** | **1,211 scenes** | Complete 15% touch-once test split (79.36M pixels) |
| **Macro Test Dice (F1)** | **`0.7670` (76.7%)** | Harmonic mean of precision and recall across scenes |
| **Macro Test mIoU** | **`0.6569` (65.7%)** | Mean Intersection over Union (Jaccard Index) |
| **Macro Test Precision** | **`0.8000` (80.0%)** | Low false alarm rate on clean seawater & lookalikes |
| **Macro Test Recall** | **`0.8073` (80.7%)** | High sensitivity for detecting genuine dark radar slicks |

### 2. Pixel-Level Confusion Matrix & Global Aggregates (79,364,096 Pixels)
| Pixel Metric | Value | Detail / Counts |
| :--- | :---: | :--- |
| **True Positives (TP)** | **17,421,653 px** | Correctly segmented oil slick surface pixels |
| **True Negatives (TN)** | **55,022,891 px** | Correctly rejected clean ocean water pixels |
| **False Positives (FP)** | **3,898,306 px** | Lookalike / wind-shadow false alarms |
| **False Negatives (FN)** | **3,021,246 px** | Missed marginal spill boundary pixels |
| **Pixel Accuracy** | **`91.28%`** | Global pixel classification accuracy |
| **Pixel Specificity** | **`93.38%`** | Ability to filter out unpolluted water |
| **Pixel Dice (F1)** | **`83.43%`** | Global pixel harmonic score |
| **Pixel IoU** | **`71.57%`** | Direct pixel intersection over union |
| **Top Suspect Confidence** | **86.9%** | `PACIFIC EXPLORER` (Rank #1 Lagrangian Attribution) |

### 3. Training & Selection Provenance
* **Backbone:** SegFormer-B2 (hierarchical Mix Transformer / MiT-B2 encoder) with transfer learning weights and lightweight MLP decoder.
* **Loss Function:** Combined `BCEDiceLoss` with sample-wise spatial Dice calculation and class-imbalance weighting (`pos_weight=2.87`).
* **Checkpoint Selection:** Checkpoint was selected strictly at **Epoch 3** based on peak validation Dice score (`0.7608`), completely independent of test-set data.
* **Visual Overlays:** Qualitative 4-panel test predictions (SAR Image, Ground Truth, Predicted Mask, Color Overlay) are generated automatically in `results/test_predictions/`.

---

## ⚙️ Deployment & Low-RAM Optimization

When hosting on free cloud platforms (e.g., Render, Koyeb, Railway) with 512MB RAM limits, SAR `.tiff` processing can be optimized to prevent memory overflow (OOM):

1. **Downsample High-Res TIFF Uploads**: Read raw `.tiff` streams with `PIL` or `cv2` and downsample to `512x512` before converting to PyTorch Tensors.
2. **Single-Thread Execution & Garbage Collection**:
   ```python
   import gc, torch
   torch.set_num_threads(1)
   with torch.no_grad():
       prediction = model(tensor)
   del tensor
   gc.collect()
   ```
3. **ONNX Conversion**: Convert `best_model.pth` to `best_model.onnx` to reduce runtime memory footprint from ~600MB down to ~120MB using `onnxruntime`.

---

## 📜 Scientific Limitations & Disclaimer

> [!IMPORTANT]  
> Suspect vessel attribution scores represent probabilistic intelligence derived from spatial proximity, velocity changes, track vectors, and AIS gap anomalies. Scores are provided for decision support and monitoring guidance alongside physical sampling and maritime authority verification.
