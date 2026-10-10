import os
import random
import pandas as pd

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

def split_dataset(images_root, masks_root, output_dir="ml/data/splits", seed=42):
    print("=" * 70, flush=True)
    print("PHASE 6 — TRAIN / VALIDATION / TEST DATASET SPLIT", flush=True)
    print("=" * 70, flush=True)

    random.seed(seed)

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

    matched_keys = sorted(list(set(img_dict.keys()).intersection(set(mask_dict.keys()))))
    print(f"Total matched image-mask pairs: {len(matched_keys)}", flush=True)

    # Shuffle reproducibly
    shuffled_keys = list(matched_keys)
    random.shuffle(shuffled_keys)

    total_count = len(shuffled_keys)
    train_end = int(0.70 * total_count)
    val_end = int(0.85 * total_count)

    train_keys = shuffled_keys[:train_end]
    val_keys = shuffled_keys[train_end:val_end]
    test_keys = shuffled_keys[val_end:]

    print(f"  Training Split   (70%) : {len(train_keys)} samples", flush=True)
    print(f"  Validation Split (15%) : {len(val_keys)} samples", flush=True)
    print(f"  Test Split       (15%) : {len(test_keys)} samples", flush=True)
    print("-" * 70, flush=True)

    os.makedirs(output_dir, exist_ok=True)

    def save_split_csv(keys, filename):
        records = []
        for k in keys:
            records.append({
                "sample_id": k,
                "image_path": img_dict[k],
                "mask_path": mask_dict[k]
            })
        df = pd.DataFrame(records)
        filepath = os.path.join(output_dir, filename)
        df.to_csv(filepath, index=False)
        print(f"  Saved {filename:<15}: {filepath} ({len(df)} rows)", flush=True)
        return filepath

    train_csv = save_split_csv(train_keys, "train.csv")
    val_csv = save_split_csv(val_keys, "validation.csv")
    test_csv = save_split_csv(test_keys, "test.csv")

    print("-" * 70, flush=True)
    print("Dataset splitting completed with ZERO data leakage between splits!")
    print("=" * 70, flush=True)
    return train_csv, val_csv, test_csv

if __name__ == "__main__":
    images_dir = r"C:\Users\snaha\Downloads\train\images"
    masks_dir = r"C:\Users\snaha\Downloads\train\masks"
    split_dataset(images_dir, masks_dir)
