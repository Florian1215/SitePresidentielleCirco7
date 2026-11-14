from django import forms

QUILL = "blog/vendor/quill-2.0.3/"


class RichTextWidget(forms.Textarea):
    """Champ texte remplacé par l'éditeur visuel Quill dans l'admin (voir static/blog/rich-editor.js).

    Le HTML produit est nettoyé côté serveur à l'enregistrement de l'article (blog/sanitize.py).
    """

    def __init__(self, attrs=None):
        super().__init__(attrs={"data-rich-editor": "1", "rows": 20, **(attrs or {})})

    class Media:
        css = {"all": [QUILL + "quill.snow.css", "blog/rich-editor.css"]}
        js = [QUILL + "quill.js", "blog/rich-editor.js"]
