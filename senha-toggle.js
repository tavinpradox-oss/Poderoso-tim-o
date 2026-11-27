document.querySelectorAll(".botao-senha").forEach((botao) => {
    const campo = document.getElementById(botao.getAttribute("aria-controls"));
    const olhoFechado = botao.querySelector(".icone-olho-fechado");
    const olhoAberto = botao.querySelector(".icone-olho-aberto");
    if (!campo) return;

    botao.addEventListener("click", () => {
        const mostrar = campo.type === "password";
        campo.type = mostrar ? "text" : "password";
        campo.classList.toggle("senha-visivel", mostrar);
        olhoFechado.toggleAttribute("hidden", mostrar);
        olhoAberto.toggleAttribute("hidden", !mostrar);
        botao.setAttribute("aria-label", `${mostrar ? "Ocultar" : "Mostrar"} senha`);
        botao.setAttribute("aria-pressed", String(mostrar));
    });
});
