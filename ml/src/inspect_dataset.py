import os
import glob
import json
import numpy as np
import cv2
from PIL import Image

def find_all_files(base_dir, valid_exts=('.png', '.tif', '.tiff', '.jpg', '.jpeg', '.bmp')):
    """Recursively search for image files, ignoring __MACOSX and hidden files."""
    file_list = []
    for root, dirs, files in os.walk(base_dir):
        # Ignore macOS metadata directories
        if '__MACOSX' in root or '.git' in root:
            continue
        for file in files:
            if file.startswith('.'):
                continue
            ext = os.path.splitext(file)[1].lower()
            if ext in valid_exts:
                file_list.append(os.path.join(root, file))
    return file_list

def inspect_dataset(images_root, masks_root, output_dir="results"):
    print("=" * 70, flush=True)
    print("PHASE 2 — ACTUAL DATASET INSPECTION REPORT", flush=True)
    print("=" * 70, flush=True)
    print(f"Images Root Directory: {images_root}", flush=True)
    print(f"Masks Root Directory : {masks_root}", flush=True)
    print("-" * 70, flush=True)

    # 1. Discover all files
    img_files = find_all_files(images_root)
    mask_files = find_all_files(masks_root)

    print(f"Total image files discovered: {len(img_files)}", flush=True)
    print(f"Total mask files discovered : {len(mask_files)}", flush=True)

    # Map files by relative path structure or basename
    def get_rel_key(filepath, root_dir):
        rel = os.path.relpath(filepath, root_dir)
        parts = rel.split(os.sep)
        if len(parts) > 1 and parts[0] in ('images', 'masks'):
            return os.path.join(*parts[1:])
        return rel

    img_dict = {get_rel_key(p, images_root): p for p in img_files}
    mask_dict = {get_rel_key(p, masks_root): p for p in mask_files}

    # Extensions check
    img_exts = sorted(list(set(os.path.splitext(f)[1].lower() for f in img_files)))
    mask_exts = sorted(list(set(os.path.splitext(f)[1].lower() for f in mask_files)))

    # Pair matching
    img_keys = set(img_dict.keys())
    mask_keys = set(mask_dict.keys())

    matched_keys = sorted(list(img_keys.intersection(mask_keys)))
    missing_masks = sorted(list(img_keys - mask_keys))
    missing_images = sorted(list(mask_keys - img_keys))

    print(f"Matched Image-Mask Pairs    : {len(matched_keys)}", flush=True)
    print(f"Missing Masks for Images    : {len(missing_masks)}", flush=True)
    print(f"Missing Images for Masks    : {len(missing_images)}", flush=True)
    print(f"Supported Image Extensions  : {img_exts}", flush=True)
    print(f"Supported Mask Extensions   : {mask_exts}", flush=True)
    print("-" * 70, flush=True)

    # Inspect properties on matched pairs
    corrupt_files = []
    shapes = set()
    channels = set()
    dtypes = set()
    img_min_val = float('inf')
    img_max_val = float('-inf')
    mask_unique_values = set()
    
    total_spill_pixels = 0
    total_bg_pixels = 0
    sample_details = []

    print("Inspecting images and masks properties & checking for corruption...", flush=True)
    for idx, key in enumerate(matched_keys):
        img_path = img_dict[key]
        mask_path = mask_dict[key]

        try:
            # Read image
            img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
            if img is None:
                corrupt_files.append((key, "Image unreadable by OpenCV"))
                continue

            # Read mask
            mask = cv2.imread(mask_path, cv2.IMREAD_UNCHANGED)
            if mask is None:
                corrupt_files.append((key, "Mask unreadable by OpenCV"))
                continue

            # Dimensionality & channels
            if len(img.shape) == 2:
                h, w = img.shape
                c = 1
            else:
                h, w, c = img.shape

            shapes.add((w, h))
            channels.add(c)
            dtypes.add(str(img.dtype))

            img_min_val = min(img_min_val, float(np.min(img)))
            img_max_val = max(img_max_val, float(np.max(img)))

            # Mask values
            u_vals = np.unique(mask)
            for uv in u_vals:
                mask_unique_values.add(int(uv))

            # Count spill pixels (assuming mask > 0 is spill)
            spill_pixels = int(np.sum(mask > 0))
            bg_pixels = int(mask.size - spill_pixels)
            total_spill_pixels += spill_pixels
            total_bg_pixels += bg_pixels

            if idx < 10 or spill_pixels > 1000:
                sample_details.append({
                    "key": key,
                    "img_shape": [h, w, c],
                    "mask_shape": list(mask.shape),
                    "img_min": float(np.min(img)),
                    "img_max": float(np.max(img)),
                    "mask_unique": [int(x) for x in u_vals],
                    "spill_pixel_count": spill_pixels
                })

            if (idx + 1) % 500 == 0:
                print(f"  Processed {idx + 1}/{len(matched_keys)} pairs...", flush=True)

        except Exception as e:
            corrupt_files.append((key, str(e)))

    print("-" * 70, flush=True)
    print("DATASET ANALYSIS SUMMARY:", flush=True)
    print(f"  Image Dimensions (W x H) : {list(shapes)}", flush=True)
    print(f"  Image Channel Count      : {list(channels)}", flush=True)
    print(f"  Data Types               : {list(dtypes)}", flush=True)
    print(f"  Image Pixel Value Range  : [{img_min_val}, {img_max_val}]", flush=True)
    print(f"  Mask Unique Values       : {sorted(list(mask_unique_values))}", flush=True)
    print(f"  Corrupt/Unreadable Files : {len(corrupt_files)}", flush=True)

    total_pixels = total_spill_pixels + total_bg_pixels
    spill_pct = (total_spill_pixels / total_pixels * 100) if total_pixels > 0 else 0
    print(f"  Total Spill Pixels       : {total_spill_pixels} ({spill_pct:.2f}%)", flush=True)
    print(f"  Total Background Pixels  : {total_bg_pixels} ({100 - spill_pct:.2f}%)", flush=True)

    # Generate visual sample overlays
    samples_dir = os.path.join(output_dir, "dataset_samples")
    os.makedirs(samples_dir, exist_ok=True)
    print("-" * 70, flush=True)
    print(f"Generating visual sample overlays in: {samples_dir}", flush=True)

    # Use sample_details accumulated during inspection pass
    spill_sample_keys = [s["key"] for s in sample_details if s["spill_pixel_count"] > 500]
    bg_sample_keys = [s["key"] for s in sample_details if s["spill_pixel_count"] == 0]

    selected_samples = (spill_sample_keys[:5] + bg_sample_keys[:2]) if spill_sample_keys else matched_keys[:5]
    if not selected_samples:
        selected_samples = matched_keys[:5]

    for i, key in enumerate(selected_samples):
        img_path = img_dict[key]
        mask_path = mask_dict[key]

        img = cv2.imread(img_path)
        if len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        
        mask_color = np.zeros_like(img)
        mask_color[mask > 0] = [0, 0, 255]

        overlay = cv2.addWeighted(img, 0.7, mask_color, 0.3, 0)
        mask_vis = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)

        combined = np.hstack([img, mask_vis, overlay])
        
        cv2.putText(combined, "SAR Image", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(combined, "Ground Truth Mask", (img.shape[1] + 10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(combined, "Overlay Visualization", (img.shape[1] * 2 + 10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        sample_filename = f"sample_{i+1}_{os.path.basename(key)}"
        cv2.imwrite(os.path.join(samples_dir, sample_filename), combined)
        print(f"  Saved sample overlay: {sample_filename}", flush=True)

    report = {
        "images_root": images_root,
        "masks_root": masks_root,
        "total_images": len(img_files),
        "total_masks": len(mask_files),
        "matched_pairs": len(matched_keys),
        "missing_masks_count": len(missing_masks),
        "missing_images_count": len(missing_images),
        "missing_masks_sample": missing_masks[:10],
        "missing_images_sample": missing_images[:10],
        "image_extensions": img_exts,
        "mask_extensions": mask_exts,
        "dimensions": [list(x) for x in shapes],
        "channel_counts": list(channels),
        "data_types": list(dtypes),
        "pixel_min": img_min_val,
        "pixel_max": img_max_val,
        "mask_unique_values": sorted(list(mask_unique_values)),
        "corrupt_files_count": len(corrupt_files),
        "corrupt_files": corrupt_files,
        "total_spill_pixels": total_spill_pixels,
        "total_bg_pixels": total_bg_pixels,
        "spill_pixel_percentage": spill_pct,
        "sample_details": sample_details
    }

    report_path = os.path.join(output_dir, "dataset_inspection_report.json")
    os.makedirs(output_dir, exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print("-" * 70, flush=True)
    print(f"Dataset inspection report saved to: {report_path}", flush=True)
    print("=" * 70, flush=True)
    return report

if __name__ == "__main__":
    images_dir = r"C:\Users\snaha\Desktop\test\images"
    masks_dir = r"C:\Users\snaha\Desktop\test\masks"
    inspect_dataset(images_dir, masks_dir)

