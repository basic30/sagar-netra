import os
import numpy as np
import cv2
import torch
from PIL import Image

def preprocess_sar_image(image_input, target_size=(256, 256)):
    """
    Preprocess SAR image for neural network input:
    - Accepts numpy array (H, W, C) or filepath.
    - Resizes to target_size if needed.
    - Scales pixel values from uint8 [0, 255] to float32 [0, 1].
    - Normalizes with ImageNet or SAR channel mean/std.
    - Returns PyTorch tensor (C, H, W) float32.
    """
    if isinstance(image_input, str):
        img = None
        ext = os.path.splitext(image_input)[1].lower()
        file_size = os.path.getsize(image_input) if os.path.exists(image_input) else 0

        # 1. Primary loader for TIFF / GeoTIFF: memory-safe decimated read (max 16MB GDAL cache)
        if ext in ('.tif', '.tiff'):
            try:
                import rasterio
                from rasterio.enums import Resampling
                with rasterio.Env(GDAL_CACHEMAX=16, VSI_CACHE=False):
                    with rasterio.open(image_input) as src:
                        data = src.read(1, out_shape=target_size, resampling=Resampling.bilinear)
                        if data is not None and data.size > 0:
                            if data.dtype != np.uint8:
                                data = cv2.normalize(data, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
                            img = cv2.cvtColor(data, cv2.COLOR_GRAY2RGB)
            except Exception:
                pass

        # 2. Fallback to PIL with thumbnailing for moderate/small files
        if img is None:
            try:
                from PIL import Image
                Image.MAX_IMAGE_PIXELS = None
                with Image.open(image_input) as pimg:
                    pimg.thumbnail(target_size)
                    img = np.array(pimg.convert('RGB'))
            except Exception:
                pass

        # 3. OpenCV fallback ONLY for standard non-TIFF images or small files (<5MB)
        if img is None and (ext not in ('.tif', '.tiff') or file_size < 5 * 1024 * 1024):
            try:
                raw = cv2.imread(image_input, cv2.IMREAD_COLOR)
                if raw is not None:
                    img = cv2.cvtColor(raw, cv2.COLOR_BGR2RGB)
            except Exception:
                pass

        if img is None:
            raise ValueError(f"Unable to read SAR image safely within memory limits: {image_input}")
    else:
        img = image_input.copy()

    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)

    h, w = img.shape[:2]
    if (h, w) != target_size:
        img = cv2.resize(img, target_size, interpolation=cv2.INTER_LINEAR)

    # Normalize to [0.0, 1.0] float32
    img_float = img.astype(np.float32) / 255.0

    # Channel mean/std normalization
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_norm = (img_float - mean) / std

    # Convert to CHW tensor
    tensor = torch.from_numpy(img_norm.transpose(2, 0, 1)).float()
    return tensor

def preprocess_mask(mask_input, target_size=(256, 256)):
    """
    Preprocess target mask:
    - Uses NEAREST-NEIGHBOR interpolation to preserve discrete labels.
    - Binarizes mask: 1 where pixel > 0, else 0.
    - Returns PyTorch tensor (1, H, W) float32.
    """
    if isinstance(mask_input, str):
        mask = cv2.imread(mask_input, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            raise ValueError(f"Unable to read mask from path: {mask_input}")
    else:
        mask = mask_input.copy()
        if len(mask.shape) == 3:
            mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)

    h, w = mask.shape[:2]
    if (h, w) != target_size:
        # Strictly nearest-neighbor interpolation for masks
        mask = cv2.resize(mask, target_size, interpolation=cv2.INTER_NEAREST)

    binary_mask = (mask > 0).astype(np.float32)
    tensor = torch.from_numpy(binary_mask).unsqueeze(0).float()
    return tensor

if __name__ == "__main__":
    print("Testing preprocessing functions...")
    dummy_img = np.random.randint(0, 256, (256, 256, 3), dtype=np.uint8)
    dummy_mask = np.random.randint(0, 256, (256, 256), dtype=np.uint8)

    img_tensor = preprocess_sar_image(dummy_img)
    mask_tensor = preprocess_mask(dummy_mask)

    print(f"Preprocessed Image Tensor Shape : {img_tensor.shape}, Dtype: {img_tensor.dtype}")
    print(f"Preprocessed Mask Tensor Shape  : {mask_tensor.shape}, Unique values: {torch.unique(mask_tensor).tolist()}")
    print("Preprocessing verification passed!")
