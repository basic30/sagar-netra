import os
import json
import numpy as np
import cv2

def find_all_files(base_dir, valid_exts=('.png', '.tif', '.tiff', '.jpg', '.jpeg', '.bmp')):
    file_list = []
    for root, dirs, files in os.walk(base_dir):
        if '__MACOSX' in root or '.git' in root:
            continue
        for file in files:
            if file.startswith('.'):
                continue
            ext = os.path.splitext(file)[1].lower()
            if ext in valid_exts:
                file_list.append(os.path.join(root, file))
    return file_list

def validate_dataset(images_root, masks_root, output_dir="results"):
    print("=" * 70, flush=True)
    print("PHASE 3 — DATASET VALIDATION REPORT", flush=True)
    print("=" * 70, flush=True)

    img_files = find_all_files(images_root)
    mask_files = find_all_files(masks_root)

    def get_rel_key(filepath, root_dir):
        rel = os.path.relpath(filepath, root_dir)
        parts = rel.split(os.sep)
        if len(parts) > 1 and parts[0] in ('images', 'masks'):
            return os.path.join(*parts[1:])
        return rel

    img_dict = {get_rel_key(p, images_root): p for p in img_files}
    mask_dict = {get_rel_key(p, masks_root): p for p in mask_files}

    img_keys = set(img_dict.keys())
    mask_keys = set(mask_dict.keys())
    matched_keys = sorted(list(img_keys.intersection(mask_keys)))

    missing_masks = sorted(list(img_keys - mask_keys))
    missing_images = sorted(list(mask_keys - img_keys))

    validation_errors = []
    dimension_mismatches = []
    corrupted_files = []

    valid_pairs_count = 0
    spill_pixels_count = 0
    bg_pixels_count = 0

    unique_label_set = set()

    for idx, key in enumerate(matched_keys):
        img_path = img_dict[key]
        mask_path = mask_dict[key]

        img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            corrupted_files.append({"file": img_path, "type": "image", "error": "OpenCV read failure"})
            continue

        mask = cv2.imread(mask_path, cv2.IMREAD_UNCHANGED)
        if mask is None:
            corrupted_files.append({"file": mask_path, "type": "mask", "error": "OpenCV read failure"})
            continue

        img_h, img_w = img.shape[:2]
        mask_h, mask_w = mask.shape[:2]

        if (img_h, img_w) != (mask_h, mask_w):
            dimension_mismatches.append({
                "key": key,
                "img_dim": [img_h, img_w],
                "mask_dim": [mask_h, mask_w]
            })
            continue

        valid_pairs_count += 1
        u_vals = np.unique(mask)
        for uv in u_vals:
            unique_label_set.add(int(uv))

        spill_p = int(np.sum(mask > 0))
        bg_p = int(mask.size - spill_p)
        spill_pixels_count += spill_p
        bg_pixels_count += bg_p

        if (idx + 1) % 1000 == 0 or (idx + 1) == len(matched_keys):
            print(f"  Validated {idx + 1}/{len(matched_keys)} image-mask pairs...", flush=True)

    total_pixels = spill_pixels_count + bg_pixels_count
    spill_ratio = spill_pixels_count / total_pixels if total_pixels > 0 else 0
    bg_ratio = bg_pixels_count / total_pixels if total_pixels > 0 else 0

    passed_validation = (
        len(matched_keys) > 0 and
        len(missing_masks) == 0 and
        len(missing_images) == 0 and
        len(corrupted_files) == 0 and
        len(dimension_mismatches) == 0
    )

    report = {
        "status": "PASSED" if passed_validation else "FAILED",
        "total_images": len(img_files),
        "total_masks": len(mask_files),
        "valid_pairs": valid_pairs_count,
        "missing_masks_count": len(missing_masks),
        "missing_images_count": len(missing_images),
        "corrupted_files_count": len(corrupted_files),
        "dimension_mismatches_count": len(dimension_mismatches),
        "unique_labels": sorted(list(unique_label_set)),
        "class_imbalance": {
            "spill_pixels": spill_pixels_count,
            "background_pixels": bg_pixels_count,
            "spill_ratio": spill_ratio,
            "background_ratio": bg_ratio,
            "imbalance_factor": (bg_pixels_count / spill_pixels_count) if spill_pixels_count > 0 else None
        }
    }

    report_path = os.path.join(output_dir, "dataset_validation_report.json")
    os.makedirs(output_dir, exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print("-" * 70, flush=True)
    print("DATASET VALIDATION REPORT")
    print(f"  Validation Status          : {report['status']}")
    print(f"  Total Images Discovered    : {report['total_images']}")
    print(f"  Total Masks Discovered     : {report['total_masks']}")
    print(f"  Valid Pairs Check Passed   : {report['valid_pairs']}")
    print(f"  Missing Masks Count        : {report['missing_masks_count']}")
    print(f"  Missing Images Count       : {report['missing_images_count']}")
    print(f"  Corrupted Files Count      : {report['corrupted_files_count']}")
    print(f"  Dimension Mismatches       : {report['dimension_mismatches_count']}")
    print(f"  Mask Segmentation Encoding : Binary / Non-zero intensity ({len(unique_label_set)} unique values)")
    print(f"  Class Ratio (Spill : BG)   : {spill_ratio*100:.2f}% : {bg_ratio*100:.2f}% (Imbalance 1:{report['class_imbalance']['imbalance_factor']:.2f})")
    print("-" * 70, flush=True)
    print(f"Saved validation report to: {report_path}", flush=True)
    print("=" * 70, flush=True)

    if not passed_validation:
        print("CRITICAL VALIDATION ERROR DETECTED! Stopping execution as required by Rule 3.", flush=True)
        return False
    return True

if __name__ == "__main__":
    images_dir = r"C:\Users\snaha\Desktop\test\images"
    masks_dir = r"C:\Users\snaha\Desktop\test\masks"
    success = validate_dataset(images_dir, masks_dir)
    if not success:
        exit(1)
