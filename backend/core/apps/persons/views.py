from rest_framework import viewsets

from .models import Person
from .serializers import PersonCreateSerializer, PersonDetailSerializer, PersonListSerializer


class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.filter(is_active=True).order_by("-created_at")
    filterset_fields = ["person_type", "is_active"]
    search_fields = ["full_name", "phone", "email"]

    def get_serializer_class(self):
        if self.action == "list":
            return PersonListSerializer
        if self.action == "create":
            return PersonCreateSerializer
        return PersonDetailSerializer
