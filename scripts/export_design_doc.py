"""Export the supplied design document to readable Markdown for repository review."""
from pathlib import Path

from docx import Document
from docx.document import Document as DocumentClass
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "docs" / "architecture" / "Taiji_Core_v0.1_技术设计文档.docx"
target = source.with_suffix(".md")
document: DocumentClass = Document(source)
lines: list[str] = []

for block in document.iter_inner_content():
    if isinstance(block, Paragraph):
        value = block.text.strip()
        if not value:
            continue
        style = block.style.name
        if style == "Title":
            lines.append(f"# {value}")
        elif style.startswith("Heading"):
            level = int(style.split()[-1]) + 1
            lines.append(f"{'#' * min(level, 6)} {value}")
        else:
            lines.append(value)
    elif isinstance(block, Table):
        rows = [[cell.text.strip().replace("\n", "<br>") for cell in row.cells] for row in block.rows]
        if len(rows) == 1 and len(rows[0]) == 1:
            lines.append(rows[0][0].replace("<br>", "\n"))
        elif rows and len(rows[0]) > 1:
            lines.append("| " + " | ".join(rows[0]) + " |")
            lines.append("| " + " | ".join(["---"] * len(rows[0])) + " |")
            for row in rows[1:]:
                lines.append("| " + " | ".join(row) + " |")

target.write_text("\n\n".join(lines) + "\n", encoding="utf-8")
print(target)
