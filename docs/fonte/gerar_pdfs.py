"""Gera os manuais em PDF do Prumo a partir dos HTML desta pasta.

Uso:  python docs/fonte/gerar_pdfs.py            # os dois
      python docs/fonte/gerar_pdfs.py manual     # só o manual
      python docs/fonte/gerar_pdfs.py banco      # só o banco de dados

Requer: pip install weasyprint==70.0
Grava o PDF na raiz do repositório e uma cópia idêntica em docs/.
As capturas de tela usadas pelo manual ficam em docs/images/.
"""
import shutil
import sys
from pathlib import Path

from weasyprint import HTML

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
DOCS = {
    "manual": ("manual.html", "Manual-Prumo.pdf"),
    "banco": ("banco-de-dados.html", "Banco-de-Dados-Prumo.pdf"),
}


def gerar(chave: str) -> Path:
    fonte, saida = DOCS[chave]
    destino = RAIZ / saida
    HTML(filename=str(AQUI / fonte), base_url=str(AQUI)).write_pdf(str(destino), optimize_images=True, jpeg_quality=85, dpi=170)
    shutil.copyfile(destino, RAIZ / "docs" / saida)
    print(f"{saida}: {destino.stat().st_size / 1024:.0f} KB")
    return destino


if __name__ == "__main__":
    for chave in (sys.argv[1:] or list(DOCS)):
        gerar(chave)
