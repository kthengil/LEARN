(function () {
  var THEME_KEY = 'learn-theme';

  function getTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    } catch (e) {}
    updateToggleUI(theme);
  }

  function updateToggleUI(theme) {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var isDark = theme === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    var sun = btn.querySelector('.icon-sun');
    var moon = btn.querySelector('.icon-moon');
    var label = btn.querySelector('.theme-label');
    if (sun) sun.style.display = isDark ? 'inline-block' : 'none';
    if (moon) moon.style.display = isDark ? 'none' : 'inline-block';
    if (label) label.textContent = isDark ? 'Light' : 'Dark';
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateToggleUI(getTheme());

    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
      });
    }

    document.querySelectorAll('.tile-compact').forEach(function (compact) {
      compact.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        var tile = compact.closest('.tile');
        if (!tile) return;
        var wasOpen = tile.classList.contains('is-expanded');
        document.querySelectorAll('.tile.is-expanded').forEach(function (t) {
          t.classList.remove('is-expanded');
        });
        if (!wasOpen) tile.classList.add('is-expanded');
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.tile')) {
        document.querySelectorAll('.tile.is-expanded').forEach(function (t) {
          t.classList.remove('is-expanded');
        });
      }
    });

    document.querySelectorAll('.copy-btn').forEach(function (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var wrap = copyBtn.closest('.code-wrap');
        var code = wrap && wrap.querySelector('pre');
        if (!code) return;
        var text = code.textContent || '';
        function markCopied() {
          var original = copyBtn.dataset.label || 'Copy';
          copyBtn.dataset.label = original;
          copyBtn.textContent = 'Copied';
          copyBtn.classList.add('copied');
          setTimeout(function () {
            copyBtn.textContent = original;
            copyBtn.classList.remove('copied');
          }, 1800);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(markCopied).catch(function () {});
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); markCopied(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });
    });
  });
})();
