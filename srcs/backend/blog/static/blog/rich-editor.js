/*
 * Éditeur visuel des articles dans l'admin Django (Quill 2).
 * Remplace chaque <textarea data-rich-editor> ; le HTML est recopié dans le textarea à l'envoi
 * du formulaire, puis nettoyé côté serveur (blog/sanitize.py).
 * Même barre d'outils que l'espace rédaction du site (frontend : shared/rich-editor.ts).
 */
(function () {
  'use strict';

  var UPLOAD_URL = '/api/articles/images/';

  var TOOLBAR = [
    [{ header: [2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
    ['blockquote', 'link', 'image', 'video'],
    ['clean'],
  ];

  var FORMATS = ['header', 'bold', 'italic', 'underline', 'strike', 'align', 'list', 'indent',
    'blockquote', 'link', 'image', 'video'];

  var LABELS = {
    'ql-bold': 'Gras (Ctrl/⌘ + B)', 'ql-italic': 'Italique (Ctrl/⌘ + I)', 'ql-underline': 'Souligné (Ctrl/⌘ + U)',
    'ql-strike': 'Barré', 'ql-blockquote': 'Citation', 'ql-link': 'Lien', 'ql-image': 'Insérer une image',
    'ql-video': 'Insérer une vidéo (YouTube, Vimeo, PeerTube)', 'ql-clean': 'Effacer la mise en forme',
    'ql-header': 'Titre', 'ql-align': 'Alignement', 'ql-list': 'Liste', 'ql-indent': 'Retrait',
  };

  function csrfToken() {
    var m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    var input = document.querySelector('input[name=csrfmiddlewaretoken]');
    return input ? input.value : '';
  }

  function upload(file) {
    var data = new FormData();
    data.append('image', file);
    return fetch(UPLOAD_URL, {
      method: 'POST',
      body: data,
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfToken() },
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error((body && (body.detail || (body.image && body.image.join(' ')))) || 'Envoi impossible');
        return body.url;
      });
    });
  }

  /** HTML propre de l'éditeur (Quill 2.0.3 remplace les espaces par des insécables : on les rétablit). */
  function html(quill) {
    if (quill.getLength() <= 1 && !quill.root.querySelector('img, iframe')) return '';
    return quill.getSemanticHTML().replace(/&nbsp;/g, ' ').replace(/ /g, ' ');
  }

  function init(textarea) {
    var holder = document.createElement('div');
    holder.className = 'rich-editor';
    var status = document.createElement('p');
    status.className = 'rich-editor-status';
    status.setAttribute('role', 'status');
    var area = document.createElement('div');
    holder.appendChild(area);
    holder.appendChild(status);
    textarea.parentNode.insertBefore(holder, textarea);
    textarea.style.display = 'none';

    function say(msg, isError) {
      status.textContent = msg || '';
      status.classList.toggle('error', !!isError);
    }

    function insertFiles(range, files) {
      var index = range ? range.index : quill.getLength();
      Array.prototype.forEach.call(files, function (file) {
        if (!/^image\//.test(file.type)) return;
        say('Envoi de l’image « ' + file.name + ' »…');
        upload(file).then(function (url) {
          quill.insertEmbed(index, 'image', url, 'user');
          quill.setSelection(index + 1, 0, 'silent');
          say('');
        }).catch(function (err) { say('Image non envoyée : ' + err.message, true); });
      });
    }

    var quill = new Quill(area, {
      theme: 'snow',
      formats: FORMATS,
      placeholder: 'Rédigez votre article…',
      modules: {
        toolbar: {
          container: TOOLBAR,
          handlers: {
            image: function () {
              var input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/png,image/jpeg,image/webp,image/gif';
              input.onchange = function () { insertFiles(quill.getSelection(true), input.files); };
              input.click();
            },
          },
        },
        // Images glissées ou collées : envoyées sur le serveur (pas d'image intégrée en base64)
        uploader: { handler: insertFiles },
      },
    });

    if (textarea.value.trim()) {
      quill.setContents(quill.clipboard.convert({ html: textarea.value }), 'silent');
    }

    // Infobulles en français
    Object.keys(LABELS).forEach(function (cls) {
      holder.querySelectorAll('.' + cls).forEach(function (el) { el.setAttribute('title', LABELS[cls]); });
    });

    var form = textarea.form;
    if (form) {
      form.addEventListener('submit', function () { textarea.value = html(quill); });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('textarea[data-rich-editor]').forEach(init);
  });
})();
