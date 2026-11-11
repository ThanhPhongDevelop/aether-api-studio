// Apply the saved theme before first paint to avoid a light/dark flash.
(function () {
  try {
    var saved = localStorage.getItem('aether-theme');
    var preference = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'dark';
    var dark =
      preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch {
    document.documentElement.classList.add('dark');
  }
})();
