(() => {
    const adminKey = "poderoso-admin-autenticado";
    const accountKey = "poderoso-conta-logada";
    const usersKey = "poderoso-contas";
    const avatarPath = "avatar-anonimo.svg";

    function obterUsuarios() {
        const usuarios = localStorage.getItem(usersKey);
        return usuarios ? JSON.parse(usuarios) : [];
    }

    function paraHexadecimal(bytes) {
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    function deHexadecimal(valor) {
        return new Uint8Array(valor.match(/.{2}/g).map((byte) => parseInt(byte, 16)));
    }

    async function criarHashSenha(senha, salt) {
        const sal = salt || crypto.getRandomValues(new Uint8Array(16));
        const chave = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(senha),
            "PBKDF2",
            false,
            ["deriveBits"]
        );
        const bits = await crypto.subtle.deriveBits(
            { name: "PBKDF2", salt: sal, iterations: 120000, hash: "SHA-256" },
            chave,
            256
        );
        return { salt: paraHexadecimal(sal), senhaHash: paraHexadecimal(new Uint8Array(bits)) };
    }

    function obterContaAtual() {
        if (sessionStorage.getItem(adminKey) === "true") {
            return { nome: "Administração", email: "administração@timao.com", admin: true };
        }

        const email = sessionStorage.getItem(accountKey);
        if (!email) return null;
        return obterUsuarios().find((usuario) => usuario.email === email) || null;
    }

    function atualizarNavegacao() {
        const conta = obterContaAtual();
        document.querySelectorAll("[data-conta-link]").forEach((link) => {
            if (!conta) return;
            link.replaceChildren();
            link.classList.add("perfil-na-navegacao");
            link.setAttribute("aria-label", conta.admin ? "Perfil administrativo" : `Conta de ${conta.nome}`);
            link.href = "conta.html";
            const foto = document.createElement("img");
            foto.src = avatarPath;
            foto.alt = "";
            foto.className = "avatar-navegacao";
            link.append(foto);
            const nome = document.createElement("span");
            nome.textContent = conta.nome;
            link.append(nome);
            if (conta.admin) link.classList.add("perfil-administrativo");
        });

        document.querySelectorAll("[data-admin-access]").forEach((link) => {
            if (sessionStorage.getItem(adminKey) === "true") {
                link.hidden = false;
                link.href = "criar.html";
                link.textContent = "Criar";
            } else if (conta) {
                link.hidden = true;
            } else {
                link.hidden = false;
                link.href = "admin.html";
                link.textContent = "Login admin";
            }
        });
    }

    const formCadastro = document.querySelector("#form-cadastro");
    const formLogin = document.querySelector("#form-login-conta");
    const acessoConta = document.querySelector("#acesso-conta");
    const estadoConta = document.querySelector("#estado-conta");

    function mostrarConta(conta) {
        if (!conta || !estadoConta || !acessoConta) return;
        acessoConta.hidden = true;
        estadoConta.hidden = false;
        document.querySelector("#nome-conta").textContent = conta.nome;
        document.querySelector("#email-conta").textContent = conta.email;
    }

    function exibirAba(aba) {
        const mostrarCadastro = aba === "cadastro";
        formCadastro.hidden = !mostrarCadastro;
        formLogin.hidden = mostrarCadastro;
        document.querySelector("#aba-cadastro").setAttribute("aria-selected", String(mostrarCadastro));
        document.querySelector("#aba-login").setAttribute("aria-selected", String(!mostrarCadastro));
    }

    if (formCadastro && formLogin) {
        try {
            const conta = obterContaAtual();
            if (conta) mostrarConta(conta);
        } catch (erro) {
            console.error("Não foi possível carregar as contas salvas:", erro);
            document.querySelector("#mensagem-cadastro").textContent = "Não foi possível carregar as contas salvas neste navegador.";
        }

        document.querySelector("#aba-cadastro").addEventListener("click", () => exibirAba("cadastro"));
        document.querySelector("#aba-login").addEventListener("click", () => exibirAba("login"));

        formCadastro.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            const mensagem = document.querySelector("#mensagem-cadastro");
            const botaoEnviar = formCadastro.querySelector('button[type="submit"]');
            const dados = new FormData(formCadastro);
            const email = String(dados.get("email")).trim().toLowerCase();
            const nome = String(dados.get("nome")).trim();
            const senha = String(dados.get("senha"));

            botaoEnviar.disabled = true;
            try {
                const usuarios = obterUsuarios();
                if (usuarios.some((usuario) => usuario.email === email)) {
                    mensagem.textContent = "Já existe uma conta com este e-mail.";
                    return;
                }

                const credencial = await criarHashSenha(senha);
                usuarios.push({ nome, email, ...credencial });
                localStorage.setItem(usersKey, JSON.stringify(usuarios));
                sessionStorage.removeItem(adminKey);
                sessionStorage.setItem(accountKey, email);
                window.location.href = "index.html";
            } catch (erro) {
                console.error("Não foi possível criar a conta:", erro);
                mensagem.textContent = "Não foi possível criar a conta neste navegador.";
            } finally {
                botaoEnviar.disabled = false;
            }
        });

        formLogin.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            const mensagem = document.querySelector("#mensagem-login-conta");
            const botaoEnviar = formLogin.querySelector('button[type="submit"]');
            const dados = new FormData(formLogin);
            const email = String(dados.get("email")).trim().toLowerCase();
            const senha = String(dados.get("senha"));

            botaoEnviar.disabled = true;
            try {
                const conta = obterUsuarios().find((usuario) => usuario.email === email);
                const credencial = conta && await criarHashSenha(senha, deHexadecimal(conta.salt));
                if (!conta || credencial.senhaHash !== conta.senhaHash) {
                    mensagem.textContent = "E-mail ou senha incorretos.";
                    return;
                }

                sessionStorage.removeItem(adminKey);
                sessionStorage.setItem(accountKey, email);
                window.location.href = "index.html";
            } catch (erro) {
                console.error("Não foi possível acessar a conta:", erro);
                mensagem.textContent = "Não foi possível acessar as contas salvas neste navegador.";
            } finally {
                botaoEnviar.disabled = false;
            }
        });

        const sair = document.querySelector("#sair-conta");
        sair.addEventListener("click", () => {
            sessionStorage.removeItem(adminKey);
            sessionStorage.removeItem(accountKey);
            window.location.href = "index.html";
        });
    }

    try {
        atualizarNavegacao();
    } catch (erro) {
        console.error("Não foi possível atualizar o perfil da navegação:", erro);
    }
})();
