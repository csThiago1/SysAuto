import pytest

from apps.items.models import NumberSequence
from apps.items.services import NumberAllocator


@pytest.mark.django_db
class TestNumberAllocator:

    def test_allocates_from_seed(self) -> None:
        # Seed de migration cria BUDGET com prefix OR- e SERVICE_ORDER com prefix OS-
        first = NumberAllocator.allocate("BUDGET")
        second = NumberAllocator.allocate("BUDGET")
        assert first == "OR-000001"
        assert second == "OR-000002"

    def test_different_sequences_independent(self) -> None:
        b1 = NumberAllocator.allocate("BUDGET")
        os1 = NumberAllocator.allocate("SERVICE_ORDER")
        b2 = NumberAllocator.allocate("BUDGET")
        os2 = NumberAllocator.allocate("SERVICE_ORDER")

        assert b1.startswith("OR-")
        assert os1.startswith("OS-")
        # números internos avançam independentemente
        assert int(b1.split("-")[1]) + 1 == int(b2.split("-")[1])
        assert int(os1.split("-")[1]) + 1 == int(os2.split("-")[1])

    def test_raises_on_unknown_type(self) -> None:
        with pytest.raises(NumberSequence.DoesNotExist):
            NumberAllocator.allocate("DOES_NOT_EXIST")

    def test_padding_respected(self) -> None:
        n = NumberAllocator.allocate("BUDGET")
        # Formato OR-NNNNNN (6 dígitos padding)
        numeric_part = n.split("-")[1]
        assert len(numeric_part) == 6
        assert numeric_part.lstrip("0") != ""
