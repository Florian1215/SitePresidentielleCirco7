"""Convertit en HTML le contenu des articles écrits en Markdown avant l'arrivée de l'éditeur visuel.

Couvre la syntaxe que proposait l'ancien éditeur : intertitres (##, ###), **gras**, _italique_,
listes (- et 1.), citations (>), liens [texte](url) et paragraphes.
"""
import html
import re

from django.db import migrations

from blog.sanitize import clean_html


def _inline(text):
    text = html.escape(text, quote=False)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+|/[^)\s]*)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"<em>\1</em>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", text)
    return text


def markdown_to_html(md):
    out, para, items, list_tag, quote = [], [], [], None, []

    def flush():
        nonlocal para, items, list_tag, quote
        if para:
            out.append("<p>" + "<br>".join(_inline(l) for l in para) + "</p>")
        if items:
            out.append(f"<{list_tag}>" + "".join(f"<li>{_inline(i)}</li>" for i in items) + f"</{list_tag}>")
        if quote:
            out.append("<blockquote>" + "<br>".join(_inline(l) for l in quote) + "</blockquote>")
        para, items, list_tag, quote = [], [], None, []

    for raw in md.replace("\r\n", "\n").split("\n"):
        line = raw.rstrip()
        if not line.strip():
            flush()
        elif m := re.match(r"^(#{1,4})\s+(.*)$", line):
            flush()
            level = min(max(len(m.group(1)), 2), 4)
            out.append(f"<h{level}>{_inline(m.group(2))}</h{level}>")
        elif m := re.match(r"^\s*[-*+]\s+(.*)$", line):
            if list_tag != "ul":
                flush()
                list_tag = "ul"
            items.append(m.group(1))
        elif m := re.match(r"^\s*\d+[.)]\s+(.*)$", line):
            if list_tag != "ol":
                flush()
                list_tag = "ol"
            items.append(m.group(1))
        elif m := re.match(r"^>\s?(.*)$", line):
            if not quote:
                flush()
            quote.append(m.group(1))
        elif re.match(r"^(-{3,}|\*{3,})$", line.strip()):
            flush()
            out.append("<hr>")
        else:
            if items or quote:
                flush()
            para.append(line)
    flush()
    return "".join(out)


def convert(apps, schema_editor):
    Article = apps.get_model("blog", "Article")
    for article in Article.objects.all():
        content = article.content or ""
        if re.search(r"<(p|h[2-4]|ul|ol|blockquote)\b", content):
            continue  # déjà en HTML
        article.content = clean_html(markdown_to_html(content))
        article.save(update_fields=["content"])


class Migration(migrations.Migration):
    dependencies = [("blog", "0003_rich_text_editor")]

    # Pas de retour automatique vers le Markdown
    operations = [migrations.RunPython(convert, migrations.RunPython.noop)]
