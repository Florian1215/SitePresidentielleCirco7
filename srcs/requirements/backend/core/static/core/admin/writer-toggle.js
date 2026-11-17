// Admin → Utilisateurs : la case « peut écrire » donne ou retire le droit d'écrire en un clic.
document.addEventListener("change", async (event) => {
  const box = event.target;
  if (!box.classList || !box.classList.contains("writer-toggle")) return;
  const csrf = document.querySelector("[name=csrfmiddlewaretoken]");
  const wanted = box.checked;
  box.disabled = true;
  try {
    const res = await fetch(box.dataset.url, {
      method: "POST",
      headers: { "X-CSRFToken": csrf ? csrf.value : "", "Content-Type": "application/x-www-form-urlencoded" },
      body: "allowed=" + (wanted ? "1" : "0"),
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    // Recharge pour mettre à jour « actif » et les filtres (un compte en attente devient actif).
    window.location.reload();
  } catch (err) {
    box.checked = !wanted;
    box.disabled = false;
    alert("Impossible de modifier le droit d'écrire (" + err.message + ").");
  }
});
