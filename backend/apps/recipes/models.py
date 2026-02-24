from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import AbstractUUIDTimestampModel


class Recipe(AbstractUUIDTimestampModel):
    external_id = models.CharField(max_length=100, blank=True, null=True)
    source = models.CharField(max_length=50)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, null=True)
    instructions = models.JSONField(default=list)
    ingredients_json = models.JSONField(default=list)
    prep_time_minutes = models.IntegerField(null=True, blank=True)
    cook_time_minutes = models.IntegerField(null=True, blank=True)
    servings = models.SmallIntegerField(null=True, blank=True)
    difficulty = models.CharField(max_length=20, blank=True, null=True)
    image_url = models.TextField(blank=True, null=True)
    nutrition = models.JSONField(null=True, blank=True)
    source_url = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "recipes"
        constraints = [
            models.UniqueConstraint(
                fields=["source", "external_id"],
                name="unique_recipe_source_external_id",
            ),
        ]

    def __str__(self):
        return self.title


class SavedRecipe(AbstractUUIDTimestampModel):
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="saved_recipes",
    )
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="saved_by",
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "saved_recipes"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "recipe"],
                name="unique_saved_recipe",
            ),
        ]

    def __str__(self):
        return f"{self.user} saved {self.recipe}"


class CookingLog(AbstractUUIDTimestampModel):
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="cooking_logs",
    )
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="cooking_logs",
    )
    cooked_at = models.DateTimeField(auto_now_add=True)
    rating = models.SmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "cooking_log"
        ordering = ["-cooked_at"]

    def __str__(self):
        return f"{self.user} cooked {self.recipe}"
