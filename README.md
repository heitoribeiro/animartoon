# Animartoon — AI Animation Studio

## Sprint 1.7 — MVP 0.8

A Animartoon agora possui dois recursos para acelerar a revisão de projetos grandes.

### Importação opcional de transcrição
Na página **Importação** é possível carregar arquivos:

- SRT;
- VTT.

A plataforma lê os intervalos de tempo das legendas e associa cada trecho às cenas da decupagem por sobreposição temporal.

Quando encontra fala:
- preenche o campo **Fala / diálogo**;
- converte cenas `A revisar` ou `Ambiente/Narração` para `Diálogo`;
- preserva falas já preenchidas por padrão;
- oferece a opção de substituir falas existentes.

Nenhum serviço externo é necessário para esse fluxo.

### Edição em massa de cenas
A página **Cenas** ganhou:

- filtros por estado;
- seleção múltipla;
- selecionar todas as cenas visíveis;
- edição coletiva de tipo;
- edição coletiva de cenário;
- edição coletiva de personagens;
- edição coletiva de som ambiente.

Filtros disponíveis:
- Todas;
- A revisar;
- Diálogo;
- Ambiente;
- Sem fala;
- Pendentes.

### Uso recomendado
Depois da decupagem automática:

1. aplicar as cenas detectadas;
2. importar SRT/VTT, quando houver;
3. filtrar `A revisar`;
4. selecionar grupos de cenas;
5. preencher cenário/personagens/ambiente em lote;
6. abrir **Detalhes** apenas nas cenas que exigirem direção individual.

## Próximos passos
- associação opcional de personagem falante;
- importação de roteiro TXT/CSV;
- pesquisa textual de cenas;
- propagação de continuidade entre subcenas A/B;
- perfis de geradores totalmente editáveis;
- projetos originais e inspirados em referência.
