# Cocktail Planner Pro

Aplicação web (100% em português do Brasil) para planejar o bar de coquetéis de um evento: calcula doses, ingredientes, gelo e embalagens comerciais, monta a lista de compras consolidada com orçamento na moeda do comprador e exporta em PDF, CSV, impressão e compartilhamento.

Estática, sem backend e sem dependências: HTML5, CSS3 e JavaScript moderno (ES Modules). Funciona em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel, Cloudflare Pages, Hostinger etc.).

---

## Estrutura

```
cocktail-planner-pro/
├── index.html               # SPA com as 6 telas (início + 5 passos)
├── manifest.webmanifest     # permite "Adicionar à tela inicial" no celular
├── .nojekyll                # necessário para o GitHub Pages servir tudo como está
├── assets/
│   ├── favicon.svg
│   └── photos/              # (opcional) fotos dos drinks — ver "Fotografias"
├── css/styles.css           # identidade visual, mobile-first, estilos de impressão
├── data/
│   ├── recipes.json         # 25 receitas (15 com álcool, 10 sem álcool)
│   └── ingredients.json     # ingredientes, categorias, embalagens e regras de conversão
├── js/
│   ├── app.js               # interface, navegação, estado (localStorage)
│   ├── calculator.js        # motor de cálculo (puro, testado)
│   ├── budget.js            # orçamento, CSV e texto para compartilhar (puro, testado)
│   ├── format.js            # formatação de quantidades e moedas
│   ├── pdf.js               # gerador de PDF próprio (sem bibliotecas)
│   ├── illustrations.js     # ilustrações vetoriais dos drinks e logotipo
│   └── recipes.js           # carregamento dos catálogos JSON
├── exemplos/                # PDFs e CSVs de exemplo (50 e 100 convidados)
├── tests/
│   ├── calculator.test.mjs  # 49 testes automatizados
│   └── generate-samples.mjs # gera PDFs/CSVs de exemplo em tests/output/
└── package.json             # scripts: npm test / npm start
```

## Como rodar no computador

O app usa ES Modules e carrega JSON, então **não funciona com duplo clique no `index.html`** (o navegador bloqueia `file://`). Use um servidor local, qualquer um destes:

```powershell
python -m http.server 5173
```

```powershell
npm start
```

Depois abra `http://localhost:5173`.

## Testes

Requer Node 18+.

```powershell
npm test
```

```powershell
node tests/generate-samples.mjs
```

O primeiro roda os 49 testes do motor de cálculo, orçamento e exportação. O segundo gera PDFs e CSVs reais em `tests/output/` (cenários de 50 e 100 convidados) usando o mesmo código do app.

## Publicar online

### GitHub Pages (gratuito)
1. Crie um repositório no GitHub e envie o conteúdo desta pasta (o `index.html` precisa ficar na raiz do repositório).
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Em 1 a 2 minutos o app fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

### Netlify (arrastar e soltar)
1. Acesse app.netlify.com → **Add new site → Deploy manually**.
2. Arraste a pasta `cocktail-planner-pro` inteira. Pronto, ele gera o link.

### Outras hospedagens
Envie todos os arquivos para a pasta pública (`public_html`, por exemplo). Não há build.

> **Entrega ao comprador:** o link publicado é o produto. Na Hotmart/Kiwify, cadastre o link na área de membros ou na página de obrigado. Se quiser restringir o acesso, publique numa URL difícil de adivinhar ou use a proteção por senha da hospedagem (Netlify e Vercel têm). O app em si não tem login.

> **Atualizações:** navegadores guardam os arquivos `.js` em cache por alguns minutos (no GitHub Pages, cerca de 10 min). Os catálogos JSON sempre são revalidados.

## Como funciona o cálculo

```
porções = convidados × % que consome × coquetéis por pessoa a cada 4 h × fator do tipo de evento × horas / 4
```

- **Perfis (por pessoa, a cada 4 h):** baixo 2 · moderado 3 · alto 4.
- **Fator por tipo de evento:** aniversário 1,0 · casamento 1,1 · reunião familiar 0,9 · corporativo 0,8 · festa em casa 1,0 · outros 1,0.
- Quem não bebe álcool toma drinks sem álcool. Se nenhum drink com álcool for escolhido, todos os convidados tomam sem álcool.
- As porções são distribuídas entre os drinks de cada grupo pela proporção definida no passo 3 (método do maior resto: a soma sempre bate com o total).
- Ingredientes iguais em receitas diferentes são **consolidados** num único item.
- Unidades nunca se misturam (ml, g, unidade, folha). Conversões só acontecem com **regra cadastrada** em `ingredients.json` → `buyAs` (ex.: "1 limão rende ≈ 30 ml de suco", "1 rodela = 1/6 de limão").
- A **margem de segurança** é aplicada à quantidade e, depois, tudo é convertido em embalagens comerciais **arredondadas para cima**.
- Extras configuráveis: gelo para resfriar (0,3 kg/convidado), água para hidratação (125 ml/convidado/hora), copos (2/convidado), guardanapos e canudos (1 por drink).

Todos esses parâmetros aparecem no app em **"Parámetros avanzados"** e podem ser editados pelo comprador.

## Personalizar o catálogo

- **Nova receita:** adicione um objeto em `data/recipes.json` (copie um existente). Quantidades são **por porção** e na unidade base do ingrediente. `visual` define as cores do líquido e as decorações da ilustração.
- **Novo ingrediente:** adicione em `data/ingredients.json` com `unit` e `package` (tamanho na mesma unidade) ou `buyAs` (conversão para outro item).
- **Mudar uma embalagem** (ex.: rum de 1 L): altere `package.size` e `package.label`.
- Depois de qualquer mudança, rode `npm test`: os testes de integridade acusam ingrediente inexistente, unidade incompatível ou receita sem álcool contendo álcool.

## Fotografias

As fotos foram geradas no ChatGPT com os prompts padronizados de [`assets/photos/PROMPTS.md`](assets/photos/PROMPTS.md) (mesmo fundo, luz e enquadramento) e convertidas para **WebP 800×800** (60–110 KB cada). Os PNGs originais em alta (1254×1254) ficam fora do app, na pasta `cocktail-planner-pro-fotos-originais/`.

As **25 receitas têm foto**. Se uma receita ficar sem foto, o app usa automaticamente a ilustração vetorial própria dela. Para adicionar ou trocar uma foto: salve `assets/photos/<id>.webp` (quadrada, 800×800) e preencha `"photo": "assets/photos/<id>.webp"` na receita em `data/recipes.json`. A foto aparece no catálogo, na ficha da receita, nas proporções e nos resultados.

## Limitações conhecidas

- **Estimativas:** os consumos são referências de planejamento, não garantia. O app avisa isso em vários pontos e no PDF.
- **Preços:** não há preços de mercado; o comprador digita os seus. Os preços ficam salvos só no navegador/dispositivo dele (localStorage).
- **PDF:** gerado no próprio navegador com as fontes padrão de PDF (Helvetica). O PDF não usa as fontes do site nem as ilustrações dos drinks, por compatibilidade e tamanho.
- **Compartilhar:** no celular abre o menu nativo (WhatsApp, e-mail…) com o PDF anexado quando o aparelho permite. No computador, copia a lista para a área de transferência.
- **Sem login e sem sincronização:** o plano fica salvo no dispositivo em que foi criado.
- **Moeda:** o padrão é o real (BRL); o comprador pode trocar para USD, EUR, MXN, COP, ARS, CLP ou PEN.

## Idioma

Todo o texto visível está em português do Brasil. Para conferir depois de editar receitas ou textos, rode `node tests/varrer_idioma.mjs`: ele procura palavras em espanhol em `index.html`, nos arquivos `js/` e nos catálogos JSON.
