# Animartoon — AI Animation Studio

## Sprint 1.5 — MVP 0.6

A Animartoon agora possui uma primeira versão de **decupagem automática de vídeo no navegador**.

### Como funciona
O usuário seleciona uma cópia local do vídeo na página **Importação**. A aplicação:

- lê o vídeo localmente, sem upload;
- amostra quadros em intervalos configuráveis;
- compara mudanças visuais entre os quadros;
- sugere pontos de corte;
- gera uma lista preliminar de cenas;
- pode dividir automaticamente segmentos acima do limite do gerador;
- mantém o resultado como prévia até o usuário decidir aplicá-lo;
- envia as cenas aplicadas para a página **Cenas**, onde podem ser revisadas.

### Modos de análise
- Rápida — 2 s;
- Equilibrada — 1 s;
- Precisa — 0,5 s.

Também há níveis de sensibilidade Baixa, Média e Alta.

### Divisão por limite do gerador
Quando ativada, uma cena longa pode ser dividida em subcenas técnicas:

```
C086A
C086B
```

A intenção é compatibilizar a produção com geradores que trabalham, por exemplo, com máximo de 8 ou 10 segundos por vídeo.

### Importante
A detecção desta Sprint é **visual e preliminar**. Ela não interpreta diálogo, narrativa ou semântica da cena. O objetivo é acelerar a decupagem inicial. A revisão humana continua necessária antes da geração dos prompts finais.

### Outras melhorias mantidas
- Google Drive Online opcional;
- Google Drive no computador;
- sincronização manual ou periódica;
- reconhecimento de arquivos de cena;
- reconhecimento de referências de personagens e cenários;
- auditoria;
- próxima ação;
- ferramentas externas: Gemini, SnapGen, Meta AI, Vibes e Grok.

## Próximos passos
- refino dos pontos de corte detectados;
- miniaturas dos quadros de início/fim de cada cena;
- edição de fala, ação, câmera e som ambiente por cena;
- transcrição/roteiro opcional;
- perfis editáveis dos geradores;
- projetos originais e inspirados em referências.
