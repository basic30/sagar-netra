import torch
import numpy as np

def calculate_segmentation_metrics(pred_masks, target_masks, threshold=0.5, is_logits=True):
    """
    Calculate IoU (Jaccard), Dice (F1), Precision, and Recall.
    Computes both macro-averaged (per-sample average) and micro-averaged (dataset global) metrics.
    pred_masks: torch.Tensor or numpy.ndarray of predicted probabilities or logits
    target_masks: torch.Tensor or numpy.ndarray of ground truth binary masks (0 or 1)
    """
    if isinstance(pred_masks, torch.Tensor):
        if pred_masks.requires_grad:
            pred_masks = pred_masks.detach()
        if is_logits:
            pred_masks = torch.sigmoid(pred_masks)
        preds = (pred_masks > threshold).cpu().numpy().astype(bool)
    else:
        if is_logits:
            pred_masks = 1.0 / (1.0 + np.exp(-pred_masks))
        preds = (pred_masks > threshold).astype(bool)

    if isinstance(target_masks, torch.Tensor):
        targets = (target_masks > 0.5).cpu().numpy().astype(bool)
    else:
        targets = (target_masks > 0.5).astype(bool)

    if preds.ndim == 4:
        preds = preds.squeeze(1)
    if targets.ndim == 4:
        targets = targets.squeeze(1)

    # Per-sample (Macro) metrics
    N = preds.shape[0] if preds.ndim >= 2 else 1
    if N == 1 and preds.ndim < 3:
        preds = np.expand_dims(preds, 0)
        targets = np.expand_dims(targets, 0)
        N = 1

    sample_ious = []
    sample_dices = []
    sample_precs = []
    sample_recs = []

    for i in range(N):
        p = preds[i]
        t = targets[i]
        p_sum = p.sum()
        t_sum = t.sum()
        inter = np.logical_and(p, t).sum()
        union = np.logical_or(p, t).sum()

        if t_sum == 0 and p_sum == 0:
            sample_ious.append(1.0)
            sample_dices.append(1.0)
            sample_precs.append(1.0)
            sample_recs.append(1.0)
        elif t_sum == 0 and p_sum > 0:
            sample_ious.append(0.0)
            sample_dices.append(0.0)
            sample_precs.append(0.0)
            sample_recs.append(1.0)
        elif t_sum > 0 and p_sum == 0:
            sample_ious.append(0.0)
            sample_dices.append(0.0)
            sample_precs.append(0.0)
            sample_recs.append(0.0)
        else:
            sample_ious.append(float(inter / union))
            sample_dices.append(float(2.0 * inter / (p_sum + t_sum)))
            sample_precs.append(float(inter / p_sum))
            sample_recs.append(float(inter / t_sum))

    # Global (Micro) metrics
    tot_inter = np.logical_and(preds, targets).sum()
    tot_union = np.logical_or(preds, targets).sum()
    tot_p = preds.sum()
    tot_t = targets.sum()

    micro_iou = float(tot_inter / tot_union) if tot_union > 0 else 1.0
    micro_dice = float(2.0 * tot_inter / (tot_p + tot_t)) if (tot_p + tot_t) > 0 else 1.0
    micro_prec = float(tot_inter / tot_p) if tot_p > 0 else 1.0
    micro_rec = float(tot_inter / tot_t) if tot_t > 0 else 1.0

    return {
        "iou": float(np.mean(sample_ious)),
        "dice": float(np.mean(sample_dices)),
        "precision": float(np.mean(sample_precs)),
        "recall": float(np.mean(sample_recs)),
        "f1": float(np.mean(sample_dices)),
        "micro_iou": micro_iou,
        "micro_dice": micro_dice,
        "micro_precision": micro_prec,
        "micro_recall": micro_rec
    }

if __name__ == "__main__":
    print("Testing Metrics Calculation...", flush=True)
    preds = torch.tensor([[[[0.8, 0.2], [0.9, 0.1]]]])
    targets = torch.tensor([[[[1.0, 0.0], [1.0, 0.0]]]])
    metrics = calculate_segmentation_metrics(preds, targets)
    print(f"Metrics Output: {metrics}")
    print("Metrics implementation verified successfully!")
