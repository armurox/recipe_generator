from django.db import models

from apps.core.models import AbstractIdTimestampModel


class IngredientCategory(AbstractIdTimestampModel):
    name = models.CharField(max_length=100, unique=True)
    default_shelf_life = models.IntegerField(
        help_text="Default shelf life duration for items in this category"
    )
    default_shelf_life_unit = models.CharField(max_length=20, default="days")
    icon = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = "ingredient_categories"
        verbose_name_plural = "ingredient categories"

    def __str__(self):
        return self.name


class Ingredient(AbstractIdTimestampModel):
    name = models.CharField(max_length=200, unique=True)
    category = models.ForeignKey(
        IngredientCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ingredients",
    )
    common_unit = models.CharField(max_length=50, default="piece")

    class Meta:
        db_table = "ingredients"

    def save(self, *args, **kwargs):
        self.name = self.name.lower().strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
