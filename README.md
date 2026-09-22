# Animartoon — AI Animation Studio

## Sprint 1.6 — MVP 0.7

A plataforma ganhou duas evoluções voltadas à revisão e direção das cenas.

### Miniaturas da decupagem
Após detectar cenas automaticamente, a tela de Importação agora permite gerar miniaturas dos quadros de início e fim dos primeiros segmentos detectados.

Isso ajuda a validar visualmente:
- se o corte faz sentido;
- se duas cenas foram divididas no ponto correto;
- se uma subcena técnica de 8–10 segundos preserva continuidade.

As miniaturas são geradas localmente no navegador a partir do arquivo selecionado.

### Direção detalhada por cena
A página **Cenas** passa a ter o botão **Detalhes**. Para cada cena é possível registrar:

- fala / diálogo;
- ação;
- câmera / enquadramento;
- som ambiente.

Esses campos passam a alimentar automaticamente os prompts de imagem e animação.

### Prompts enriquecidos
O prompt de imagem incorpora ação e orientação de câmera.

O prompt de animação passa a incorporar:
- duração;
- ação;
- fala e sincronização labial quando aplicável;
- som ambiente;
- direção de câmera;
- continuidade visual.

## Próximos passos
- validar a calibração real da decupagem;
- miniaturas para mais cenas sob demanda;
- edição em massa de cenas;
- transcrição opcional;
- perfis editáveis dos geradores;
- projeto original e projeto inspirado em referência.
