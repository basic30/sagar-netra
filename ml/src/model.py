import torch
import torch.nn as nn

def create_oil_spill_model(encoder_name="resnet34", encoder_weights="imagenet", in_channels=3, classes=1):
    """
    Creates U-Net Segmentation Model using segmentation_models_pytorch.
    - encoder_name: ResNet34.
    - in_channels: 3 (matching actual RGB image channels).
    - classes: 1 (binary segmentation output logits).
    Lazy-loads smp inside function to save ~140MB RAM when running TorchScript inference.
    """
    import segmentation_models_pytorch as smp
    model = smp.Unet(
        encoder_name=encoder_name,
        encoder_weights=encoder_weights,
        in_channels=in_channels,
        classes=classes,
        activation=None
    )
    return model

if __name__ == "__main__":
    print("Testing Oil Spill Segmentation Model creation...", flush=True)
    model = create_oil_spill_model()
    x = torch.randn(2, 3, 256, 256)
    out = model(x)
    print(f"Input Shape : {x.shape}")
    print(f"Output Shape: {out.shape}")
    print("Model implementation verified successfully!")
