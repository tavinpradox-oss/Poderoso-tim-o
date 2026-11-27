(() => {
    const databaseName = "poderoso-timao-noticias";
    const databaseVersion = 1;
    const storeName = "noticias";
    const deletedStaticNewsKey = "poderoso-noticias-estaticas-excluidas";

    function administradorEstaLogado() {
        return sessionStorage.getItem("poderoso-admin-autenticado") === "true";
    }

    function obterNoticiasEstaticasExcluidas() {
        const valor = localStorage.getItem(deletedStaticNewsKey);
        const noticias = valor ? JSON.parse(valor) : [];
        if (!Array.isArray(noticias)) {
            throw new Error("A lista de notícias excluídas está inválida.");
        }
        return noticias;
    }

    function abrirBanco() {
        return new Promise((resolve, reject) => {
            const requisicao = indexedDB.open(databaseName, databaseVersion);
            requisicao.onupgradeneeded = () => {
                requisicao.result.createObjectStore(storeName, { keyPath: "id" });
            };
            requisicao.onsuccess = () => resolve(requisicao.result);
            requisicao.onerror = () => reject(requisicao.error);
        });
    }

    async function obterNoticias() {
        const banco = await abrirBanco();
        return new Promise((resolve, reject) => {
            const requisicao = banco.transaction(storeName, "readonly").objectStore(storeName).getAll();
            requisicao.onsuccess = () => resolve(requisicao.result.sort((a, b) => b.criadaEm - a.criadaEm));
            requisicao.onerror = () => reject(requisicao.error);
        });
    }

    async function salvarNoticia(noticia) {
        const banco = await abrirBanco();
        return new Promise((resolve, reject) => {
            const transacao = banco.transaction(storeName, "readwrite");
            transacao.objectStore(storeName).add(noticia);
            transacao.oncomplete = () => resolve();
            transacao.onerror = () => reject(transacao.error);
            transacao.onabort = () => reject(transacao.error || new Error("Não foi possível salvar a notícia."));
        });
    }

    async function excluirNoticia(id) {
        if (!administradorEstaLogado()) {
            throw new Error("É necessário estar logado como administrador para excluir notícias.");
        }

        if (id.startsWith("estatica:")) {
            const href = id.slice("estatica:".length);
            const excluidas = obterNoticiasEstaticasExcluidas();
            if (excluidas.includes(href)) {
                throw new Error("A notícia já foi excluída.");
            }
            localStorage.setItem(deletedStaticNewsKey, JSON.stringify([...excluidas, href]));
            return;
        }

        const banco = await abrirBanco();
        return new Promise((resolve, reject) => {
            const transacao = banco.transaction(storeName, "readwrite");
            const armazenamento = transacao.objectStore(storeName);
            const requisicao = armazenamento.get(id);

            requisicao.onsuccess = () => {
                if (!requisicao.result) {
                    transacao.abort();
                    return;
                }
                armazenamento.delete(id);
            };
            requisicao.onerror = () => reject(requisicao.error);
            transacao.oncomplete = () => {
                banco.close();
                resolve();
            };
            transacao.onerror = () => {
                banco.close();
                reject(transacao.error);
            };
            transacao.onabort = () => {
                banco.close();
                reject(transacao.error || new Error("A notícia não foi encontrada."));
            };
        });
    }

    function elemento(tag, classe, texto) {
        const node = document.createElement(tag);
        if (classe) node.className = classe;
        if (texto !== undefined) node.textContent = texto;
        return node;
    }

    function criarBotaoExcluir(noticia) {
        const botao = elemento("button", "botao-excluir-noticia", "Excluir");
        botao.type = "button";
        botao.setAttribute("aria-label", `Excluir notícia: ${noticia.titulo}`);
        botao.addEventListener("click", () => solicitarExclusao(noticia));
        return botao;
    }

    function definirDestaque(artigo, destaque) {
        artigo.classList.toggle("noticia-destaque", destaque);
        const titulo = artigo.querySelector("h1, h2");
        if (!titulo) return;

        const tagDesejada = destaque ? "h1" : "h2";
        if (titulo.tagName.toLowerCase() === tagDesejada) return;

        const novoTitulo = document.createElement(tagDesejada);
        Array.from(titulo.attributes).forEach((atributo) => {
            novoTitulo.setAttribute(atributo.name, atributo.value);
        });
        while (titulo.firstChild) {
            novoTitulo.append(titulo.firstChild);
        }
        titulo.replaceWith(novoTitulo);
    }

    function criarCard(noticia, destaque) {
        const artigo = elemento("article", destaque ? "noticia noticia-destaque" : "noticia");
        artigo.dataset.noticiaId = noticia.id;
        const imagemComTitulo = elemento("div", "imagem-com-titulo");
        imagemComTitulo.append(elemento("span", "etiqueta-imagem", noticia.tag));

        const linkImagem = elemento("a");
        linkImagem.href = `noticia-criada.html?id=${encodeURIComponent(noticia.id)}`;
        const imagem = elemento("img", "imagem-noticia");
        imagem.src = URL.createObjectURL(noticia.imagem);
        imagem.alt = noticia.titulo;
        linkImagem.append(imagem);
        imagemComTitulo.append(linkImagem);

        const texto = elemento("div", "texto-noticia");
        texto.append(elemento(destaque ? "h1" : "h2", "", noticia.titulo));
        texto.append(elemento("p", "", noticia.subtitulo));
        artigo.append(imagemComTitulo, texto);
        if (administradorEstaLogado()) {
            artigo.append(criarBotaoExcluir(noticia));
        }
        return artigo;
    }

    function prepararNoticiasEstaticas() {
        const excluidas = obterNoticiasEstaticasExcluidas();
        document.querySelectorAll(".grade-noticias .noticia:not([data-noticia-id])").forEach((artigo) => {
            const link = artigo.querySelector(".imagem-com-titulo > a[href]");
            if (!link) return;

            const href = link.getAttribute("href");
            const id = `estatica:${href}`;
            const titulo = artigo.querySelector("h1, h2").textContent.trim();
            artigo.dataset.noticiaId = id;
            if (excluidas.includes(href)) {
                artigo.remove();
                return;
            }
            if (administradorEstaLogado()) {
                artigo.append(criarBotaoExcluir({ id, titulo }));
            }
        });

        const detalhe = document.querySelector("[data-static-noticia-id]");
        if (!detalhe) return;

        const href = detalhe.dataset.staticNoticiaId;
        const id = `estatica:${href}`;
        detalhe.dataset.noticiaId = id;
        if (excluidas.includes(href)) {
            const aviso = elemento("p", "", "Esta notícia foi removida pelo administrador.");
            const voltar = elemento("a", "", "Voltar para notícias");
            voltar.href = "TODAS.html";
            detalhe.replaceChildren(aviso, voltar);
            return;
        }
        if (administradorEstaLogado()) {
            const titulo = detalhe.querySelector("h1").textContent.trim();
            detalhe.append(criarBotaoExcluir({ id, titulo }));
        }
    }

    let dialogoExclusao;

    function obterDialogoExclusao() {
        if (dialogoExclusao) return dialogoExclusao;

        dialogoExclusao = elemento("dialog", "dialogo-exclusao");
        dialogoExclusao.setAttribute("aria-labelledby", "titulo-confirmacao-exclusao");
        const titulo = elemento("h2", "", "Você tem certeza?");
        titulo.id = "titulo-confirmacao-exclusao";
        const descricao = elemento("p", "", "Esta notícia será removida do site.");
        const mensagem = elemento("p", "mensagem-exclusao", "");
        mensagem.setAttribute("role", "alert");
        mensagem.setAttribute("aria-live", "polite");
        const acoes = elemento("div", "acoes-exclusao");
        const confirmar = elemento("button", "botao-confirmar-exclusao", "Sim, tenho certeza");
        confirmar.type = "button";
        const voltar = elemento("button", "botao-voltar-exclusao", "Voltar");
        voltar.type = "button";
        acoes.append(confirmar, voltar);
        dialogoExclusao.append(titulo, descricao, mensagem, acoes);
        document.body.append(dialogoExclusao);

        voltar.addEventListener("click", () => dialogoExclusao.close());
        confirmar.addEventListener("click", async () => {
            if (!administradorEstaLogado()) {
                mensagem.textContent = "Sua sessão administrativa terminou. Entre novamente.";
                return;
            }

            confirmar.disabled = true;
            mensagem.textContent = "";
            try {
                await excluirNoticia(dialogoExclusao.dataset.noticiaId);
                const areaNoticia = document.querySelector("#noticia-criada, [data-static-noticia-id]");
                dialogoExclusao.close();
                if (areaNoticia) {
                    window.location.href = "TODAS.html";
                    return;
                }
                window.location.reload();
            } catch (erro) {
                console.error("Erro ao excluir notícia:", erro);
                mensagem.textContent = "Não foi possível excluir a notícia. Tente novamente.";
            } finally {
                confirmar.disabled = false;
            }
        });

        return dialogoExclusao;
    }

    function solicitarExclusao(noticia) {
        if (!administradorEstaLogado()) return;
        const dialogo = obterDialogoExclusao();
        dialogo.dataset.noticiaId = noticia.id;
        dialogo.querySelector(".mensagem-exclusao").textContent = "";
        dialogo.showModal();
    }

    async function renderizarListas() {
        const areaInicio = document.querySelector(".destaques-inicio");
        const areaRecentes = document.querySelector('[aria-label="Lista de notícias"]');
        if (!areaInicio && !areaRecentes) return;

        const noticias = await obterNoticias();
        const oficial = noticias.filter((noticia) => noticia.tipo === "oficial");
        const rumores = noticias.filter((noticia) => noticia.tipo === "rumor");

        if (areaInicio) {
            const noticiasEstaticas = Array.from(
                areaInicio.querySelectorAll('.noticia[data-noticia-id^="estatica:"]')
            );
            const noticiaPrincipalEstatica = noticiasEstaticas[0];
            noticiasEstaticas.forEach((artigo, indice) => {
                definirDestaque(artigo, oficial.length === 0 && indice === 0);
            });

            const fragmento = document.createDocumentFragment();
            oficial.forEach((noticia, indice) => {
                fragmento.append(criarCard(noticia, indice === 0));
            });
            rumores.forEach((noticia) => fragmento.append(criarCard(noticia, false)));
            if (oficial.length > 0 || !noticiaPrincipalEstatica) {
                areaInicio.prepend(fragmento);
            } else {
                noticiaPrincipalEstatica.after(fragmento);
            }
        }

        if (areaRecentes) {
            const fragmento = document.createDocumentFragment();
            noticias.forEach((noticia) => fragmento.append(criarCard(noticia, false)));
            areaRecentes.prepend(fragmento);
        }
    }

    async function mostrarNoticia() {
        const area = document.querySelector("#noticia-criada");
        if (!area) return;
        const id = new URLSearchParams(window.location.search).get("id");
        if (!id) {
            area.textContent = "Notícia não encontrada.";
            return;
        }

        const noticia = (await obterNoticias()).find((item) => item.id === id);
        if (!noticia) {
            area.textContent = "Esta notícia não está disponível neste navegador.";
            return;
        }

        document.title = `${noticia.titulo} | Poderoso Timão`;
        const titulo = elemento("h1", "", noticia.titulo);
        const subtitulo = elemento("p", "linha-fina", noticia.subtitulo);
        const imagem = elemento("img", "foto-confronto");
        imagem.src = URL.createObjectURL(noticia.imagem);
        imagem.alt = noticia.titulo;
        const credito = elemento("figcaption", "legenda-foto", noticia.credito);
        const figura = elemento("figure", "imagem-materia");
        figura.append(imagem, credito);

        const texto = elemento("section", "texto-materia");
        noticia.texto.split(/\r?\n/).filter(Boolean).forEach((paragrafo) => {
            texto.append(elemento("p", "", paragrafo));
        });

        const videoTitulo = elemento("h2", "", "Vídeo");
        const video = elemento("video");
        video.controls = true;
        video.preload = "metadata";
        video.src = URL.createObjectURL(noticia.video);
        const videoArea = elemento("section", "video-destaques");
        const videoContainer = elemento("div", "video-container");
        videoContainer.append(video);
        videoArea.append(videoTitulo, videoContainer);
        if (noticia.legendaVideo) {
            videoArea.append(elemento("p", "instrucao-video", noticia.legendaVideo));
        }

        area.dataset.noticiaId = noticia.id;
        const conteudo = [titulo, subtitulo, figura, texto, videoArea];
        if (administradorEstaLogado()) {
            conteudo.push(criarBotaoExcluir(noticia));
        }

        area.replaceChildren(...conteudo);
    }

    const formularioLogin = document.querySelector("#form-login");
    if (formularioLogin && sessionStorage.getItem("poderoso-admin-autenticado") === "true") {
        window.location.replace("criar.html");
    }

    const formularioNoticia = document.querySelector("#form-noticia");
    if (formularioNoticia) {
        if (sessionStorage.getItem("poderoso-admin-autenticado") !== "true") {
            window.location.replace("admin.html");
        } else {
            formularioNoticia.addEventListener("submit", async (evento) => {
                evento.preventDefault();
                const mensagem = document.querySelector("#mensagem-noticia");
                const dados = new FormData(formularioNoticia);
                const imagem = dados.get("imagem");
                const video = dados.get("video");

                if (!(imagem instanceof File) || imagem.size === 0 || !(video instanceof File) || video.size === 0) {
                    mensagem.textContent = "Selecione uma imagem e um vídeo válidos.";
                    return;
                }

                const noticia = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    criadaEm: Date.now(),
                    titulo: dados.get("titulo").trim(),
                    imagem,
                    credito: dados.get("credito").trim(),
                    subtitulo: dados.get("subtitulo").trim(),
                    tag: dados.get("tag").trim(),
                    texto: dados.get("texto").trim(),
                    video,
                    legendaVideo: dados.get("legendaVideo").trim(),
                    tipo: dados.get("tipo")
                };

                try {
                    await salvarNoticia(noticia);
                    window.location.href = "index.html";
                } catch (erro) {
                    console.error("Erro ao salvar notícia no navegador:", erro);
                    mensagem.textContent = "Não foi possível salvar. Verifique o espaço disponível no navegador e tente novamente.";
                }
            });
        }
    }

    const sair = document.querySelector("#sair-admin");
    if (sair) {
        sair.addEventListener("click", () => {
            sessionStorage.removeItem("poderoso-admin-autenticado");
            window.location.href = "admin.html";
        });
    }

    try {
        prepararNoticiasEstaticas();
    } catch (erro) {
        console.error("Erro ao carregar notícias antigas:", erro);
    }

    renderizarListas().catch((erro) => console.error("Erro ao carregar notícias:", erro));
    mostrarNoticia().catch((erro) => console.error("Erro ao abrir notícia:", erro));
})();
