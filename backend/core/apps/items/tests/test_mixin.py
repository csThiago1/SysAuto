from apps.items.mixins import ItemFieldsMixin


class TestItemFieldsMixin:

    def test_is_abstract(self) -> None:
        assert ItemFieldsMixin._meta.abstract is True

    def test_choices_are_present(self) -> None:
        assert ("PART", "Peça") in ItemFieldsMixin.ITEM_TYPE_CHOICES
        assert ("IMPACTO", "Impacto") in ItemFieldsMixin.BUCKET_CHOICES
        assert ("COMPLEMENTO_PARTICULAR", "Complemento Particular") in ItemFieldsMixin.PAYER_BLOCK_CHOICES
