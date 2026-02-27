from datetime import date

from django.db import models

from apps.core.models import AbstractUUIDTimestampModel


class PantryItem(AbstractUUIDTimestampModel):
    class Source(models.TextChoices):
        RECEIPT_SCAN = "receipt_scan", "Receipt Scan"
        MANUAL = "manual", "Manual"

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        EXPIRED = "expired", "Expired"
        USED_UP = "used_up", "Used Up"

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="pantry_items",
    )
    ingredient = models.ForeignKey(
        "ingredients.Ingredient",
        on_delete=models.PROTECT,
        related_name="pantry_items",
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    unit = models.CharField(max_length=50, blank=True, null=True)
    added_date = models.DateField(default=date.today)
    expiry_date = models.DateField(null=True, blank=True)
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
    )
    receipt_scan = models.ForeignKey(
        "receipts.ReceiptScan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pantry_items",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )

    class Meta:
        db_table = "pantry_items"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "ingredient"],
                condition=models.Q(status="available"),
                name="unique_available_pantry_item",
            ),
        ]
        ordering = ["expiry_date"]

    def __str__(self):
        return f"{self.ingredient} ({self.status})"
