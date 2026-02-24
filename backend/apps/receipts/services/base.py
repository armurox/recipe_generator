from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ExtractedItem:
    raw_text: str
    name: str
    quantity: float | None = None
    unit: str | None = None
    price: float | None = None
    is_food: bool = True
    category_hint: str | None = None


@dataclass
class ReceiptExtractionResult:
    store_name: str | None
    items: list[ExtractedItem] = field(default_factory=list)
    raw_response: dict = field(default_factory=dict)


class OCRExtractionError(Exception):
    """Raised when OCR extraction fails (API error, download failure, etc.)."""


class OCRProvider(ABC):
    @abstractmethod
    async def extract_receipt(self, image_url: str) -> ReceiptExtractionResult:
        """Extract structured receipt data from an image URL."""
