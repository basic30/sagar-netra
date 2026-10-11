import os
import sys
import random
import numpy as np
import pandas as pd
import cv2
import torch
from torch.utils.data import Dataset, DataLoader

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from ml.src.preprocess import preprocess_sar_image, preprocess_mask

class OilSpillDataset(Dataset):
    """
    PyTorch Dataset for Marine Oil Spill SAR Imagery.
    Supports actual image and mask loading with train augmentation.
    """
    def __init__(self, csv_file, is_train=False, img_size=(256, 256)):
        self.df = pd.read_csv(csv_file)
        self.is_train = is_train
        self.img_size = img_size

    def __len__(self):
        return len(self.df)

    def _apply_augmentations(self, img, mask):
        # 1. Random Horizontal Flip
        if random.random() > 0.5:
            img = cv2.flip(img, 1)
            mask = cv2.flip(mask, 1)

        # 2. Random Vertical Flip
        if random.random() > 0.5:
            img = cv2.flip(img, 0)
            mask = cv2.flip(mask, 0)

        # 3. Random 90-degree Rotation
        rot_k = random.choice([0, 1, 2, 3])
        if rot_k > 0:
            img = np.rot90(img, rot_k).copy()
            mask = np.rot90(mask, rot_k).copy()

        return img, mask

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_path = row["image_path"]
        mask_path = row["mask_path"]

        img = cv2.imread(img_path, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Failed to read image: {img_path}")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            raise ValueError(f"Failed to read mask: {mask_path}")

        if self.is_train:
            img, mask = self._apply_augmentations(img, mask)

        img_tensor = preprocess_sar_image(img, target_size=self.img_size)
        mask_tensor = preprocess_mask(mask, target_size=self.img_size)

        metadata = {
            "sample_id": row["sample_id"],
            "image_path": img_path,
            "mask_path": mask_path
        }

        return img_tensor, mask_tensor, metadata

if __name__ == "__main__":
    print("Testing OilSpillDataset Loader...", flush=True)
    train_csv = "ml/data/splits/train.csv"
    if os.path.exists(train_csv):
        ds = OilSpillDataset(train_csv, is_train=True)
        loader = DataLoader(ds, batch_size=4, shuffle=True)

        img_b, mask_b, meta_b = next(iter(loader))
        print(f"Batch Image Tensor Shape : {img_b.shape}")
        print(f"Batch Mask Tensor Shape  : {mask_b.shape}")
        print(f"Image Tensor Min / Max   : {img_b.min().item():.3f} / {img_b.max().item():.3f}")
        print(f"Mask Tensor Unique Values: {torch.unique(mask_b).tolist()}")
        print("OilSpillDataset verification passed!")
