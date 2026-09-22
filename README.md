# Animartoon — AI Animation Studio

## Sprint 1.5.1 — MVP 0.6.1

Correção da decupagem automática após o primeiro teste real com **Abraão e Isaque**.

### Problema identificado
O teste mostrou:

- 151 segmentos;
- 0 cortes visuais;
- 151 subcenas técnicas.

Isso significava que o detector não estava encontrando mudanças visuais e apenas dividia o vídeo inteiro em blocos de aproximadamente 10 segundos.

### Correções
- espera explícita pelo quadro efetivamente decodificado após cada seek;
- uso de `requestVideoFrameCallback` quando disponível;
- amostragem aumentada para 64×36;
- detecção por picos relativos de diferença visual;
- limiar adaptativo calculado pela distribuição dos próprios quadros;
- níveis de sensibilidade passam a representar a fração de maiores diferenças visuais analisadas;
- intervalo mínimo entre cortes para evitar cortes duplicados;
- IDs de subcenas agora suportam A...Z, AA, AB etc.;
- painel passa a mostrar o limiar calculado e a maior diferença visual encontrada.

### Como testar
Na página **Importação**:

1. selecione novamente o vídeo local;
2. escolha **Equilibrada — 1 s** e **Sensibilidade Média**;
3. mantenha marcada a opção de dividir cenas acima do limite do gerador;
4. clique em **Detectar cenas**.

O resultado esperado é que o campo **Cortes visuais** deixe de ficar em zero. O número total não precisa coincidir exatamente com a análise externa de referência, mas deve ficar em uma faixa plausível e com cortes distribuídos pelo vídeo.

## Próximo refinamento
Após esse teste, calibrar a detecção para se aproximar da decupagem visual de referência e então adicionar miniaturas de início/fim de cena.
