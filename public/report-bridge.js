// report-bridge.js — thin loader.
// The original monolithic bridge was split into independent modules to keep each
// file small and reliable. This loader injects them in their original execution
// order. They communicate only via window.* globals, so order is defensive only.
(function () {
  var MODULES = [
    "report-bridge.core.js",
    "report-bridge.period.js",
    "report-bridge.entry.js",
  ];

  function baseDir() {
    try {
      var cur = document.currentScript && document.currentScript.src;
      if (cur) return cur.replace(/[^/]*$/, "");
    } catch (_e) {}
    return "/";
  }

  var dir = baseDir();

  MODULES.forEach(function (name) {
    var id = "ln-mod-" + name.replace(/[^a-z0-9]+/gi, "-");
    if (document.getElementById(id)) return;
    var s = document.createElement("script");
    s.id = id;
    s.src = dir + name;
    s.async = false;
    s.defer = false;
    (document.head || document.documentElement).appendChild(s);
  });
})();
