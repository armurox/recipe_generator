from django.db import models

from apps.core.models import AbstractIdTimestampModel, AbstractUUIDTimestampModel


class ReceiptScan(AbstractUUIDTimestampModel):
    class Status(models.TextChoices):
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="receipt_scans",
    )
    image_url = models.TextField()
    store_name = models.CharField(max_length=200, blank=True, null=True)
    scanned_at = models.DateTimeField(auto_now_add=True)
    raw_extraction = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROCESSING,
    )

    class Meta:
        db_table = "receipt_scans"
        ordering = ["-scanned_at"]

    def __str__(self):
        return f"Scan {self.id} ({self.status})"


class ReceiptItem(AbstractIdTimestampModel):
    receipt = models.ForeignKey(
        ReceiptScan,
        on_delete=models.CASCADE,
        related_name="items",
    )
    ingredient = models.ForeignKey(
        "ingredients.Ingredient",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipt_items",
    )
    raw_text = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    unit = models.CharField(max_length=50, blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "receipt_items"

    def __str__(self):
        return self.raw_text
