"""
Paddock Solutions — Banks Serializers
"""
from rest_framework import serializers

from apps.banks.models import Bank


class BankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bank
        fields = ["id", "code", "name", "logo_url", "is_active"]
        read_only_fields = ["id"]
