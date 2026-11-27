const botao = document.querySelector(".botao");
const botaoMenu = document.querySelector(".botao-menu");
const menuLateral = document.querySelector("#menu-lateral");
const fundoMenu = document.querySelector(".fundo-menu");

if (botao) {
  botao.addEventListener("click", () => {
    alert("Vai, Corinthians!");
  });
}

if (botaoMenu && menuLateral && fundoMenu) {
  const fecharMenu = () => {
    menuLateral.classList.remove("aberto");
    fundoMenu.hidden = true;
    botaoMenu.setAttribute("aria-expanded", "false");
    botaoMenu.setAttribute("aria-label", "Abrir menu");
    botaoMenu.focus();
  };

  botaoMenu.addEventListener("click", () => {
    const menuEstaAberto = botaoMenu.getAttribute("aria-expanded") === "true";

    if (menuEstaAberto) {
      fecharMenu();
      return;
    }

    menuLateral.classList.add("aberto");
    fundoMenu.hidden = false;
    botaoMenu.setAttribute("aria-expanded", "true");
    botaoMenu.setAttribute("aria-label", "Fechar menu");
    menuLateral.querySelector("button").focus();
  });

  fundoMenu.addEventListener("click", fecharMenu);

  menuLateral.querySelectorAll("button, a").forEach((item) => {
    item.addEventListener("click", fecharMenu);
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && botaoMenu.getAttribute("aria-expanded") === "true") {
      fecharMenu();
    }
  });
}