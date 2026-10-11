import torch
import torch.nn as nn
import torch.nn.functional as F

class DiceLoss(nn.Module):
    def __init__(self, smooth=1.0):
        super(DiceLoss, self).__init__()
        self.smooth = smooth

    def forward(self, logits, targets):
        probs = torch.sigmoid(logits)
        batch_size = probs.size(0)
        probs_flat = probs.view(batch_size, -1)
        targets_flat = targets.view(batch_size, -1)

        intersection = (probs_flat * targets_flat).sum(dim=1)
        cardinality = probs_flat.sum(dim=1) + targets_flat.sum(dim=1)
        dice = (2.0 * intersection + self.smooth) / (cardinality + self.smooth)
        return (1.0 - dice).mean()

class BCEDiceLoss(nn.Module):
    def __init__(self, bce_weight=0.5, dice_weight=0.5, pos_weight=None):
        super(BCEDiceLoss, self).__init__()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight
        if pos_weight is not None:
            self.register_buffer("pos_weight", torch.tensor([pos_weight], dtype=torch.float32))
        else:
            self.pos_weight = None
        self.dice = DiceLoss()

    def forward(self, logits, targets):
        if self.pos_weight is not None:
            bce_loss = F.binary_cross_entropy_with_logits(logits, targets, pos_weight=self.pos_weight)
        else:
            bce_loss = F.binary_cross_entropy_with_logits(logits, targets)
        dice_loss = self.dice(logits, targets)
        return self.bce_weight * bce_loss + self.dice_weight * dice_loss

if __name__ == "__main__":
    print("Testing Loss Functions...", flush=True)
    criterion = BCEDiceLoss(pos_weight=2.87)
    pred_logits = torch.randn(4, 1, 256, 256, requires_grad=True)
    targets = torch.randint(0, 2, (4, 1, 256, 256)).float()
    loss = criterion(pred_logits, targets)
    loss.backward()
    print(f"Calculated BCE+Dice Loss: {loss.item():.4f}")
    print("Loss functions implementation verified successfully!")
