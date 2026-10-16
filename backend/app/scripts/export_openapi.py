"""Exporta o contrato OpenAPI para o frontend gerar seus tipos.

Uso: python -m app.scripts.export_openapi ../frontend/openapi.json
"""

import json
import sys
from pathlib import Path

from app.main import app


def main() -> None:
    destination = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.json")
    destination.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Contrato exportado para {destination}")


if __name__ == "__main__":
    main()
