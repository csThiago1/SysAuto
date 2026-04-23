"""imports.services — thin re-export de apps.cilia.dtos.ImportService.

A implementação completa vive em apps.cilia.dtos.ImportService.
Este módulo provê o caminho canônico de import para views e tasks de apps.imports.
"""
from apps.cilia.dtos import ImportService as _CiliaImportService

# Re-exporta todas as interfaces públicas
ImportService = _CiliaImportService
