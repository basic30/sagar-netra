import os
import sys
import json
import numpy as np
import cv2
import torch
from torch.utils.data import DataLoader

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from ml.src.dataset import OilSpillDataset
from ml.src.model import create_oil_spill_model
from ml.src.metrics import calculate_segmentation_metrics

def evaluate_best_model(test_csv="ml/data/splits/test.csv",
                        checkpoint_path="ml/checkpoints/best_model.pth",
                        meta_path="ml/checkpoints/best_model_meta.json",
                        results_dir="results",
                        batch_size=16,
                        device=None):

    print("=" * 75, flush=True)
    print("PHASE 13 — FULL UNTOUCHED TEST SET EVALUATION (ALL 1,211 SAMPLES)", flush=True)
    print("=" * 75, flush=True)

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluation Compute Device: {device}", flush=True)

    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint file not found: {checkpoint_path}")

    # Display Checkpoint Selection Provenance
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            meta = json.load(f)
        print("\n--- CHECKPOINT PROVENANCE ---", flush=True)
        print(f"  Checkpoint File        : {checkpoint_path}")
        print(f"  Selected Epoch         : Epoch {meta.get('selected_epoch', 'N/A')}")
        print(f"  Selection Criterion    : {meta.get('selection_metric', 'Validation Dice Score')}")
        print(f"  Peak Validation Dice   : {meta.get('val_dice', 0.0):.4f}")
        print(f"  Peak Validation mIoU   : {meta.get('val_iou', 0.0):.4f}")
        print(f"  Selection Note         : {meta.get('selection_note', 'Selected strictly on validation set')}")
        print("-" * 75, flush=True)
    else:
        print(f"Loading checkpoint: {checkpoint_path} (No meta file found)", flush=True)

    model = create_oil_spill_model(encoder_name="resnet34", encoder_weights="imagenet").to(device)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    model.eval()

    test_dataset = OilSpillDataset(test_csv, is_train=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    total_test_samples = len(test_dataset)
    total_batches = len(test_loader)
    print(f"\nEvaluating FULL Test Dataset: Exactly {total_test_samples} samples across {total_batches} batches...")
    print("Zero artificial batch limits. Processing all batches...", flush=True)

    test_preds_list = []
    test_targets_list = []
    sample_metas = []

    with torch.no_grad():
        for t_idx, (imgs, masks, metas) in enumerate(test_loader):
            imgs = imgs.to(device)
            outputs = model(imgs)

            test_preds_list.append(outputs.cpu())
            test_targets_list.append(masks.cpu())

            for i in range(len(metas["sample_id"])):
                sample_metas.append({
                    "sample_id": metas["sample_id"][i],
                    "image_path": metas["image_path"][i],
                    "mask_path": metas["mask_path"][i]
                })

            if (t_idx + 1) % 15 == 0 or (t_idx + 1) == total_batches:
                print(f"  Batch {t_idx + 1:02d}/{total_batches} processed ({(t_idx + 1) * batch_size if (t_idx + 1) < total_batches else total_test_samples}/{total_test_samples} images)...", flush=True)

    test_preds_cat = torch.cat(test_preds_list, dim=0)
    test_targets_cat = torch.cat(test_targets_list, dim=0)

    # 1. Macro & Micro Metric Calculation
    metrics = calculate_segmentation_metrics(test_preds_cat, test_targets_cat, is_logits=True)

    # 2. Detailed Pixel Confusion Matrix Calculation
    probs = torch.sigmoid(test_preds_cat).numpy()
    binary_preds = (probs > 0.5).astype(bool)
    binary_targets = (test_targets_cat.numpy() > 0.5).astype(bool)

    tp = int(np.logical_and(binary_preds, binary_targets).sum())
    fp = int(np.logical_and(binary_preds, ~binary_targets).sum())
    fn = int(np.logical_and(~binary_preds, binary_targets).sum())
    tn = int(np.logical_and(~binary_preds, ~binary_targets).sum())
    total_pixels = tp + fp + fn + tn

    pixel_accuracy = float((tp + tn) / total_pixels) if total_pixels > 0 else 0.0
    pixel_specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    pixel_precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    pixel_recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    pixel_dice = float(2 * tp / (2 * tp + fp + fn)) if (2 * tp + fp + fn) > 0 else 0.0
    pixel_iou = float(tp / (tp + fp + fn)) if (tp + fp + fn) > 0 else 0.0

    print("\n" + "=" * 75, flush=True)
    print("FINAL HONEST TEST SET EVALUATION RESULTS (1,211 SAMPLES)", flush=True)
    print("=" * 75, flush=True)
    print(f"  Total Test Images Evaluated : {total_test_samples}")
    print(f"  Total Pixels Evaluated      : {total_pixels:,}")
    print("-" * 75, flush=True)
    print("MACRO-AVERAGED METRICS (Mean Across 1,211 Test Scenes):")
    print(f"  Test mIoU (Mean Jaccard)    : {metrics['iou']:.4f} ({metrics['iou']*100:.2f}%)")
    print(f"  Test Dice / F1 Score        : {metrics['dice']:.4f} ({metrics['dice']*100:.2f}%)")
    print(f"  Test Precision              : {metrics['precision']:.4f} ({metrics['precision']*100:.2f}%)")
    print(f"  Test Recall (Sensitivity)  : {metrics['recall']:.4f} ({metrics['recall']*100:.2f}%)")
    print("-" * 75, flush=True)
    print("PIXEL-LEVEL CONFUSION MATRIX & AGGREGATES:")
    print(f"  True Positives (TP)         : {tp:,} pixels")
    print(f"  False Positives (FP)        : {fp:,} pixels")
    print(f"  False Negatives (FN)        : {fn:,} pixels")
    print(f"  True Negatives (TN)         : {tn:,} pixels")
    print(f"  Pixel Accuracy              : {pixel_accuracy:.4f} ({pixel_accuracy*100:.2f}%)")
    print(f"  Pixel Specificity           : {pixel_specificity:.4f} ({pixel_specificity*100:.2f}%)")
    print(f"  Pixel Precision             : {pixel_precision:.4f} ({pixel_precision*100:.2f}%)")
    print(f"  Pixel Recall                : {pixel_recall:.4f} ({pixel_recall*100:.2f}%)")
    print(f"  Pixel Dice / F1             : {pixel_dice:.4f} ({pixel_dice*100:.2f}%)")
    print(f"  Pixel IoU                   : {pixel_iou:.4f} ({pixel_iou*100:.2f}%)")
    print("=" * 75, flush=True)

    # Save comprehensive metrics report
    report = {
        "checkpoint_evaluated": checkpoint_path,
        "total_test_samples": total_test_samples,
        "total_pixels_evaluated": total_pixels,
        "macro_metrics": {
            "mIoU": metrics["iou"],
            "dice_f1": metrics["dice"],
            "precision": metrics["precision"],
            "recall": metrics["recall"]
        },
        "confusion_matrix": {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "true_negatives": tn
        },
        "pixel_metrics": {
            "accuracy": pixel_accuracy,
            "specificity": pixel_specificity,
            "precision": pixel_precision,
            "recall": pixel_recall,
            "dice_f1": pixel_dice,
            "iou": pixel_iou
        }
    }

    os.makedirs(results_dir, exist_ok=True)
    metrics_path = os.path.join(results_dir, "test_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nSaved complete test metrics report to: {metrics_path}", flush=True)

    # 3. Generate Qualitative Test Predictions
    test_pred_dir = os.path.join(results_dir, "test_predictions")
    os.makedirs(test_pred_dir, exist_ok=True)

    spill_indices = [i for i in range(len(sample_metas)) if test_targets_cat[i].sum() > 800]
    bg_indices = [i for i in range(len(sample_metas)) if test_targets_cat[i].sum() == 0]

    selected_indices = spill_indices[:4] + bg_indices[:2]
    if len(selected_indices) < 6:
        selected_indices = list(range(min(6, len(sample_metas))))

    print(f"Generating qualitative test prediction panels in: {test_pred_dir}", flush=True)
    for idx in selected_indices:
        meta = sample_metas[idx]
        img_orig = cv2.imread(meta["image_path"])
        if img_orig is None:
            continue
        gt_mask = cv2.imread(meta["mask_path"], cv2.IMREAD_GRAYSCALE)
        if gt_mask is None:
            continue

        pred_prob = probs[idx, 0]
        pred_mask = (pred_prob > 0.5).astype(np.uint8) * 255

        h, w = img_orig.shape[:2]
        gt_mask = cv2.resize(gt_mask, (w, h), interpolation=cv2.INTER_NEAREST)
        pred_mask = cv2.resize(pred_mask, (w, h), interpolation=cv2.INTER_NEAREST)

        # Overlays
        gt_vis = cv2.cvtColor(gt_mask, cv2.COLOR_GRAY2BGR)
        pred_vis = cv2.cvtColor(pred_mask, cv2.COLOR_GRAY2BGR)

        overlay_red = np.zeros_like(img_orig)
        overlay_red[pred_mask > 0] = [0, 0, 255] # Red highlight for predicted spill
        overlay = cv2.addWeighted(img_orig, 0.7, overlay_red, 0.3, 0)

        # 4-panel: Original SAR | Ground Truth | Model Prediction | Overlay
        panel = np.hstack([img_orig, gt_vis, pred_vis, overlay])
        cv2.putText(panel, "1. Original SAR", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(panel, "2. Ground Truth", (w + 10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(panel, "3. Predicted Mask", (w*2 + 10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(panel, "4. Spill Overlay", (w*3 + 10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        fname = f"test_pred_{idx+1}_{os.path.basename(meta['sample_id'])}"
        cv2.imwrite(os.path.join(test_pred_dir, fname), panel)
        print(f"  Saved 4-panel test sample: {fname}", flush=True)

    print("=" * 75, flush=True)
    return report

if __name__ == "__main__":
    evaluate_best_model()
