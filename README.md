# Animartoon — AI Animation Studio

## Sprint 1.8.3 — MVP 0.9.3

Foi adicionado um fluxo específico para testar a fonte do YouTube.

### Teste do link
Na página **Importação**, ao lado de **Salvar URL**, existe agora o botão:

```
Testar link do YouTube
```

A Animartoon:
- valida o formato da URL;
- extrai o ID do vídeo;
- tenta obter metadados públicos via oEmbed;
- exibe título/autor quando disponíveis;
- mostra uma prévia incorporada do vídeo;
- mantém o link como referência oficial do projeto.

### Limitação importante
Uma página estática hospedada no GitHub Pages não pode ler os pixels internos do player do YouTube por causa das restrições de origem do navegador. Portanto, o link pode ser validado e visualizado, mas a detecção automática de cortes não consegue operar diretamente sobre o player incorporado.

Para análise automática de cenas a partir do link, a arquitetura precisa de um **serviço separado de análise**. Esse serviço pode ser adicionado futuramente sem alterar o restante da aplicação.

### Situação do vídeo local
O fluxo local permanece disponível e agora possui diagnóstico explícito quando o navegador não entrega quadros diferentes para o canvas.

## Próximo passo técnico
- criar um serviço opcional de análise de vídeo;
- manter o GitHub Pages como front-end;
- devolver para a Animartoon somente a lista de cortes, tempos e metadados de cenas.
