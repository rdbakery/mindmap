document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  
  document.addEventListener("keydown", function (e) {
    // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) ||
      (e.ctrlKey && e.key === "U")
    ) {
      e.preventDefault();
    }
  });

  setInterval(function () {
    const start = performance.now();
    debugger;
    const end = performance.now();
    if (end - start > 100) {
      alert("DevTools is open!");
      window.location.reload();
    }
  }, 1000);