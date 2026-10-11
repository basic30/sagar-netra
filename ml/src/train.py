import os
import sys
import json
import time
import random
import numpy as np
import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from ml.src.dataset import OilSpillDataset
from ml.src.model import create_oil_spill_model
from ml.src.losses import BCEDiceLoss
from ml.src.metrics import calculate_segmentation_metrics

def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

def train_model(train_csv="ml/data/splits/train.csv",
                val_csv="ml/data/splits/validation.csv",
                checkpoint_dir="ml/checkpoints",
                results_dir="results",
                epochs=6,
                batch_size=16,
                batches_per_epoch=40,
                val_batches=20,
                lr=8e-4,
                patience=3,
                device=None):

    print("=" * 70, flush=True)
    print("PHASE 11 — PYTORCH U-NET MODEL TRAINING & VALIDATION", flush=True)
    print("=" * 70, flush=True)

    set_seed(42)

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training Compute Device: {device}", flush=True)
    if device.type == "cpu":
        torch.set_num_threads(min(8, os.cpu_count() or 4))
        print(f"Using {torch.get_num_threads()} CPU execution threads", flush=True)

    os.makedirs(checkpoint_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)

    print("Loading DataLoaders...", flush=True)
    train_dataset = OilSpillDataset(train_csv, is_train=True)
    val_dataset = OilSpillDataset(val_csv, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"  Total Training Pool   : {len(train_dataset)} samples")
    print(f"  Total Validation Pool : {len(val_dataset)} samples")
    train_steps_per_epoch = min(len(train_loader), batches_per_epoch) if batches_per_epoch else len(train_loader)
    val_steps_per_epoch = min(len(val_loader), val_batches) if val_batches else len(val_loader)
    print(f"  Batches per Epoch     : {train_steps_per_epoch} train batches ({train_steps_per_epoch * batch_size} samples)")
    print(f"  Validation Evaluation : {val_steps_per_epoch} val batches ({val_steps_per_epoch * batch_size} samples)")
    print("-" * 70, flush=True)

    # Initializing U-Net with pretrained ImageNet ResNet-34 encoder
    model = create_oil_spill_model(encoder_name="resnet34", encoder_weights="imagenet").to(device)
    criterion = BCEDiceLoss(bce_weight=0.5, dice_weight=0.5, pos_weight=2.87).to(device)

    # Differential learning rate: lower LR for pretrained encoder to prevent feature destruction
    encoder_params = list(model.encoder.parameters())
    decoder_params = [p for n, p in model.named_parameters() if not n.startswith("encoder.")]
    optimizer = optim.AdamW([
        {"params": encoder_params, "lr": lr * 0.25},
        {"params": decoder_params, "lr": lr}
    ], weight_decay=1e-4)

    # Scheduler monitors validation Dice (higher is better)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=1)

    history = {
        "train_loss": [],
        "val_loss": [],
        "val_iou": [],
        "val_dice": [],
        "val_precision": [],
        "val_recall": [],
        "learning_rate": []
    }

    best_val_dice = -1.0
    best_val_iou = -1.0
    best_val_loss = float("inf")
    best_epoch = 0

    best_model_path = os.path.join(checkpoint_dir, "best_model.pth")
    last_model_path = os.path.join(checkpoint_dir, "last_model.pth")

    epochs_without_improvement = 0

    for epoch in range(1, epochs + 1):
        epoch_start_time = time.time()
        print(f"\n--- Epoch {epoch:02d}/{epochs:02d} ---", flush=True)

        # Training loop
        model.train()
        running_train_loss = 0.0
        train_count = 0

        for batch_idx, (imgs, masks, _) in enumerate(train_loader):
            if batches_per_epoch and batch_idx >= batches_per_epoch:
                break

            imgs = imgs.to(device)
            masks = masks.to(device)

            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()

            batch_samples = imgs.size(0)
            running_train_loss += loss.item() * batch_samples
            train_count += batch_samples

            if (batch_idx + 1) % 10 == 0 or (batch_idx + 1) == train_steps_per_epoch:
                print(f"  [Epoch {epoch:02d}] Step {batch_idx + 1:02d}/{train_steps_per_epoch} - Loss: {loss.item():.4f}", flush=True)

        epoch_train_loss = running_train_loss / train_count

        # Validation loop
        model.eval()
        running_val_loss = 0.0
        val_preds_list = []
        val_targets_list = []
        val_count = 0

        with torch.no_grad():
            for v_idx, (imgs, masks, _) in enumerate(val_loader):
                if val_batches and v_idx >= val_batches:
                    break
                imgs = imgs.to(device)
                masks = masks.to(device)

                outputs = model(imgs)
                loss = criterion(outputs, masks)

                batch_samples = imgs.size(0)
                running_val_loss += loss.item() * batch_samples
                val_count += batch_samples

                val_preds_list.append(outputs.cpu())
                val_targets_list.append(masks.cpu())

        epoch_val_loss = running_val_loss / val_count
        val_preds_cat = torch.cat(val_preds_list, dim=0)
        val_targets_cat = torch.cat(val_targets_list, dim=0)

        val_metrics = calculate_segmentation_metrics(val_preds_cat, val_targets_cat, is_logits=True)
        current_lr = optimizer.param_groups[1]['lr']
        epoch_duration = time.time() - epoch_start_time

        history["train_loss"].append(float(epoch_train_loss))
        history["val_loss"].append(float(epoch_val_loss))
        history["val_iou"].append(float(val_metrics["iou"]))
        history["val_dice"].append(float(val_metrics["dice"]))
        history["val_precision"].append(float(val_metrics["precision"]))
        history["val_recall"].append(float(val_metrics["recall"]))
        history["learning_rate"].append(float(current_lr))

        print(f"Epoch {epoch:02d}/{epochs:02d} ({epoch_duration:.1f}s) | "
              f"Train Loss: {epoch_train_loss:.4f} | Val Loss: {epoch_val_loss:.4f} | "
              f"Val mIoU: {val_metrics['iou']:.4f} | Val Dice: {val_metrics['dice']:.4f} | "
              f"Val Prec: {val_metrics['precision']:.4f} | Val Rec: {val_metrics['recall']:.4f} | LR: {current_lr:.6f}", flush=True)

        scheduler.step(val_metrics["dice"])

        # Save Checkpoints
        torch.save(model.state_dict(), last_model_path)

        # STRICT Checkpoint Selection: Best validation Dice score (NOT loss, and NOT test set)
        if val_metrics["dice"] > best_val_dice:
            best_val_dice = val_metrics["dice"]
            best_val_iou = val_metrics["iou"]
            best_val_loss = epoch_val_loss
            best_epoch = epoch
            epochs_without_improvement = 0

            # Save model weights
            torch.save(model.state_dict(), best_model_path)

            # Save metadata recording why this checkpoint was chosen
            meta = {
                "selected_epoch": best_epoch,
                "selection_metric": "Validation Dice Score (Macro F1)",
                "val_dice": float(best_val_dice),
                "val_iou": float(best_val_iou),
                "val_loss": float(best_val_loss),
                "encoder": "resnet34 (ImageNet pretrained)",
                "selection_note": "Selected strictly on validation set peak Dice. Test set was NOT used for selection."
            }
            with open(os.path.join(checkpoint_dir, "best_model_meta.json"), "w") as f:
                json.dump(meta, f, indent=2)

            print(f"  --> [NEW BEST CHECKPOINT SAVED] Epoch {epoch:02d} | Val Dice: {best_val_dice:.4f} | Val mIoU: {best_val_iou:.4f} | Val Loss: {best_val_loss:.4f}", flush=True)
        else:
            epochs_without_improvement += 1
            print(f"  No Dice improvement for {epochs_without_improvement}/{patience} epochs (Peak Dice was {best_val_dice:.4f} at Epoch {best_epoch:02d})", flush=True)
            if epochs_without_improvement >= patience:
                print(f"\n[EARLY STOPPING TRIGGERED] Validation Dice plateaued. Restoring peak Epoch {best_epoch:02d}.", flush=True)
                break

    print("-" * 70, flush=True)
    print(f"Training Finished! Selected Checkpoint from Epoch {best_epoch:02d} with Peak Val Dice: {best_val_dice:.4f}, Val mIoU: {best_val_iou:.4f}")
    print(f"Best Model File: {best_model_path}")
    print("=" * 70, flush=True)

    # Generate Visualization Plots
    print("Generating Training Curves (Loss, IoU, Dice)...", flush=True)
    completed_epochs = len(history["train_loss"])
    epochs_range = range(1, completed_epochs + 1)

    # 1. Training & Validation Loss Plot
    plt.figure(figsize=(8, 5))
    plt.plot(epochs_range, history["train_loss"], label="Training Loss", color="blue", marker="o")
    plt.plot(epochs_range, history["val_loss"], label="Validation Loss", color="red", marker="s")
    plt.axvline(x=best_epoch, color="gray", linestyle="--", label=f"Selected Checkpoint (Epoch {best_epoch})")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.title("Training & Validation Loss Curve")
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(results_dir, "training_loss.png"), dpi=150)
    plt.close()

    # 2. Validation IoU Plot
    plt.figure(figsize=(8, 5))
    plt.plot(epochs_range, history["val_iou"], label="Validation mIoU", color="green", marker="^")
    plt.axvline(x=best_epoch, color="gray", linestyle="--", label=f"Selected Checkpoint (Epoch {best_epoch})")
    plt.xlabel("Epoch")
    plt.ylabel("mIoU Score")
    plt.title("Validation mIoU Curve")
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(results_dir, "iou_curve.png"), dpi=150)
    plt.close()

    # 3. Validation Dice Plot
    plt.figure(figsize=(8, 5))
    plt.plot(epochs_range, history["val_dice"], label="Validation Dice (F1)", color="purple", marker="d")
    plt.axvline(x=best_epoch, color="gray", linestyle="--", label=f"Selected Checkpoint (Epoch {best_epoch})")
    plt.xlabel("Epoch")
    plt.ylabel("Dice Score")
    plt.title("Validation Dice Score Curve")
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(results_dir, "dice_curve.png"), dpi=150)
    plt.close()

    # Save history json
    with open(os.path.join(results_dir, "training_history.json"), "w") as f:
        json.dump(history, f, indent=2)

    print("Saved plots: training_loss.png, iou_curve.png, dice_curve.png", flush=True)
    return best_model_path, history

if __name__ == "__main__":
    train_model(epochs=6, batch_size=16, batches_per_epoch=40, val_batches=20)
