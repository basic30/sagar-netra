import sys
import importlib

def check_package(package_name, import_name=None):
    if import_name is None:
        import_name = package_name
    try:
        mod = importlib.import_module(import_name)
        version = getattr(mod, '__version__', 'unknown')
        print(f"  [OK] {package_name:<30} (version: {version})")
        return True
    except ImportError as e:
        print(f"  [MISSING] {package_name:<25} -> {e}")
        return False

def verify_environment():
    print("=" * 60)
    print("ENVIRONMENT VERIFICATION REPORT")
    print("=" * 60)
    print(f"Python Executable: {sys.executable}")
    print(f"Python Version   : {sys.version.split()[0]}")
    print("-" * 60)

    required_modules = [
        ("torch", "torch"),
        ("torchvision", "torchvision"),
        ("segmentation_models_pytorch", "segmentation_models_pytorch"),
        ("numpy", "numpy"),
        ("pandas", "pandas"),
        ("opencv-python", "cv2"),
        ("scikit-learn", "sklearn"),
        ("rasterio", "rasterio"),
        ("geopandas", "geopandas"),
        ("shapely", "shapely"),
        ("xarray", "xarray"),
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("sqlalchemy", "sqlalchemy"),
        ("pydantic", "pydantic"),
    ]

    all_passed = True
    for pkg, imp in required_modules:
        if not check_package(pkg, imp):
            all_passed = False

    print("-" * 60)
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        device_name = torch.cuda.get_device_name(0) if cuda_available else "CPU (CUDA not available)"
        print(f"PyTorch Compute Device: {device_name}")
    except Exception as e:
        print(f"PyTorch Device Check: Error ({e})")

    print("-" * 60)
    if all_passed:
        print("RESULT: ALL REQUIRED PACKAGES ARE INSTALLED & READY!")
    else:
        print("RESULT: SOME PACKAGES ARE MISSING OR COULD NOT BE IMPORTED.")
    print("=" * 60)
    return all_passed

if __name__ == "__main__":
    verify_environment()
