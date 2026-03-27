from django.db import models


class Person(models.Model):
    PERSON_TYPES = [
        ("CLIENT", "Cliente"),
        ("EMPLOYEE", "Colaborador"),
        ("INSURER", "Seguradora"),
        ("BROKER", "Corretor"),
    ]

    full_name = models.CharField(max_length=200)
    person_type = models.CharField(max_length=20, choices=PERSON_TYPES)
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.person_type})"
