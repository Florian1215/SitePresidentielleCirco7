"""Nettoyage du HTML des articles (produit par l'éditeur Quill), appliqué à chaque enregistrement.

Seules les balises et attributs nécessaires à la mise en forme sont conservés : tout le reste
(scripts, styles, attributs d'événement, iframes d'autres sites…) est supprimé. Le site peut
ensuite afficher ce HTML tel quel.
"""
import re

import nh3

TAGS = {
    "p", "br", "h2", "h3", "h4", "strong", "em", "u", "s", "a", "ul", "ol", "li",
    "blockquote", "img", "iframe", "hr", "code", "pre", "sub", "sup",
}

ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "width", "height"},
    "iframe": {"src", "allowfullscreen", "title"},
    "ol": {"start"},
}

# Alignement et retrait de l'éditeur, vidéos intégrées
ALIGN = {"ql-align-center", "ql-align-right", "ql-align-justify"}
INDENT = {f"ql-indent-{i}" for i in range(1, 9)}
CLASSES = {tag: ALIGN | INDENT for tag in ("p", "h2", "h3", "h4", "li", "blockquote")}
CLASSES["iframe"] = {"ql-video"}

# Vidéos acceptées : YouTube (sans cookie de préférence), Vimeo, PeerTube (chemins /videos/embed/)
VIDEO_SRC = re.compile(
    r"^https://(www\.youtube(-nocookie)?\.com/embed/|player\.vimeo\.com/video/|[\w.-]+/videos/embed/)[\w/?=&%.-]*$"
)


def _filter(tag, attr, value):
    if tag == "iframe" and attr == "src":
        return value if VIDEO_SRC.match(value) else None
    if tag == "a" and attr == "target":
        return "_blank" if value == "_blank" else None
    if tag == "img" and attr == "src":
        # Images téléversées sur le site ou servies en HTTPS
        return value if value.startswith(("/media/", "https://")) else None
    return value


def clean_html(html: str) -> str:
    cleaned = nh3.clean(
        html or "",
        tags=TAGS,
        attributes=ATTRIBUTES,
        allowed_classes=CLASSES,
        attribute_filter=_filter,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
    )
    # Une iframe dont l'adresse a été refusée ne sert à rien : on la retire
    return re.sub(r"<iframe(?![^>]*\bsrc=)[^>]*>\s*</iframe>", "", cleaned)
