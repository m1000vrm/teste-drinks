# Testes realizados — Cocktail Planner Pro v1.0

Data: 25/11/2026. Resultado: **49 de 49 testes automatizados passando** (`npm test`) e verificação manual no navegador (desktop 1024 px e celular 375 px).

## Automatizados (`tests/calculator.test.mjs`)

| Área | O que foi verificado |
|---|---|
| Catálogo | 25 receitas (15 + 10); todos os campos obrigatórios; todo ingrediente, copo e utensílio existe; receitas sem álcool não têm ingrediente alcoólico; todo ingrediente tem embalagem ou regra de conversão |
| Fórmula | Fórmula base conferida contra conta manual; **10, 50 e 100 convidados × 2, 4, 6 e 8 horas** (12 cenários, com e sem álcool); crescimento linear com a duração (150/300/450/600); perfis baixo/alto; casamento (×1,1) e corporativo (×0,8); parâmetros personalizados |
| Seleções | Só drinks com álcool (sem porções sem álcool + aviso); só drinks sem álcool (todos os convidados, nenhum item alcoólico); 0 % de consumidores de álcool; seleção vazia (erro em português); receita duplicada contada uma vez |
| Proporções | Soma sempre igual ao total (0 a 1234 porções); 60/30/10 exato; peso 0 exclui; todos 0 divide igual; 3:1 → 90/30 |
| Ingredientes | Gim-tônica exata (7.500 ml → 10 garrafas; 22.500 ml → 65 latas de 350 ml); rum repetido em 3 receitas consolidado num item só; suco (ml), gomos e rodelas convertidos em limões com regra cadastrada; unidades nunca misturadas (todas as 25 receitas); regras inválidas rejeitadas; gelo = receitas + resfriamento; água de hidratação |
| Margem e arredondamento | 10 % aplicado antes do arredondamento (7.500 → 8.250 ml → 11 garrafas); quantidade exata não arredonda a mais; mínimo de 1 embalagem; 30 % com 100 convidados/8 h: sempre compra o suficiente e nunca uma embalagem a mais |
| Validação | Mensagens em português para todos os campos; convidados não inteiros rejeitados |
| Orçamento | Custo por item, total, por convidado e por drink; quantidade editada substitui a calculada; preços vazios/negativos ignorados; 8 moedas formatadas |
| Exportação | CSV com BOM UTF-8, separador `;`, uma linha por item, aspas e `;` escapados, coluna "Comprado"; texto de compartilhamento por categoria |

## Manuais no navegador

| Teste | Resultado |
|---|---|
| Fluxo completo início → evento → drinks → proporções → resultados → compras | OK |
| Validação: 0 convidados bloqueia o avanço, campo em vermelho, mensagem em português | OK |
| Estimativa ao vivo no passo 1 (150 drinks para 50 convidados, 4 h, moderado, 80 %) | OK |
| Catálogo: filtro com/sem álcool, busca por nome ou ingrediente, selecionar/remover, ficha da receita | OK |
| Proporções: Mojito 100 vs. 50/50 → 60/30/30 de 120 porções | OK |
| Resultados: 150 drinks (120 + 30), ingredientes por categoria, "ver detalhe" com origem de cada quantidade | OK |
| Orçamento: gin 3×20 + rum 6×15,50 (quantidade editada) + gelo 16×5 = $233,00; $4,66/convidado; $1,55/drink | OK |
| Preço com vírgula decimal ("15,50") | OK |
| Marcar como comprado + barra de progresso | OK |
| Troca de moeda (USD → COP sem decimais) mantendo os preços | OK |
| PDF: aberto num leitor real (pdf.js); 2 páginas (50 convidados) e 4 páginas (100 convidados, 25 receitas, 44 itens); acentos, logotipo, cabeçalho repetido, numeração de páginas | OK |
| Impressão: relatório gerado com 31 linhas; layout conferido simulando a mídia de impressão | OK |
| Compartilhar: envia o PDF (34 KB) + texto da lista; sem suporte, copia para a área de transferência | OK |
| "Empezar de nuevo": pede confirmação, limpa dados e volta ao passo 1 | OK |
| Abrir `#resultados` sem drinks redireciona para o catálogo com aviso | OK |
| Celular 375 px: nenhuma tela com rolagem horizontal (6 telas verificadas) | OK |
| Tradução PT-BR: varredura de 1.493 textos (HTML, JS, catálogos) e do texto renderizado das 6 telas + ficha de receita: nenhum termo em espanhol | OK |
| Moeda padrão BRL: orçamento de exemplo R$ 482,00; CSV e PDF em português com R$, ç e ã corretos | OK |
| 25 fotos no catálogo, nenhuma quebrada | OK |

## Bugs encontrados e corrigidos durante os testes

1. Barra de ação fixa sumia: a animação de entrada criava um bloco de contenção. A animação passou para os filhos da tela.
2. Indicadores (KPIs) com rótulo, valor e legenda na mesma linha → layout em coluna.
3. Decorações dos drinks cortadas no topo do card → mais espaço no SVG.
4. Botão "Agregar" cortado em 5 colunas → botões empilhados.
5. Hortelã superestimada (29 maços para 75 mojitos) → maço de ≈60 folhas e raminho de ≈4 folhas (17 maços).
6. Catálogo JSON em cache após atualização → carregamento com revalidação.
7. Celular: a etapa de navegação estourava a largura (446 px) → versão compacta.
8. Celular: campo de quantidade da lista de compras espremido → linha inteira.
9. PDF: círculo decorativo vazando da caixa de orçamento → removido.

## Não testado

- Impressão física e o diálogo "Salvar como PDF" do sistema (abri o layout de impressão simulado, não a janela do sistema).
- Menu de compartilhamento nativo num celular físico (testado com a API simulada).
- Safari/iOS e Firefox: testado apenas no Chromium do painel do app.
