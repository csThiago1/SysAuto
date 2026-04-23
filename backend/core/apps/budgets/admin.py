from django.contrib import admin
from .models import Budget, BudgetVersion, BudgetVersionItem

admin.site.register(Budget)
admin.site.register(BudgetVersion)
admin.site.register(BudgetVersionItem)
