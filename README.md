# Animartoon — AI Animation Studio

## Sprint 1.9 — MVP 1.0

A Animartoon passa a usar uma arquitetura híbrida:

- **GitHub Pages** para a interface;
- **Railway** para análise pesada de vídeo;
- **FFmpeg/FFprobe** para detecção real de cortes.

### Serviço de análise
Foi criado o serviço `animartoon-analyzer` com:

- `GET /health`;
- `POST /analyze-upload`;
- upload temporário de vídeo;
- leitura da duração via FFprobe;
- detecção de cortes via FFmpeg `scene`;
- divisão técnica opcional conforme duração máxima do gerador;
- retorno JSON com tempos, cortes e cenas;
- descarte do arquivo após o processamento;
- CORS restrito ao front-end da Animartoon.

### Front-end
A página **Importação** ganhou o card **Analisador FFmpeg — Serviço**.

Fluxo:
1. selecionar o arquivo local;
2. testar o serviço;
3. clicar em **Analisar arquivo com FFmpeg**;
4. acompanhar o upload;
5. receber os cortes detectados;
6. revisar e aplicar a decupagem.

### YouTube
O link do YouTube continua sendo validado e exibido como referência. A análise de pixels diretamente do player incorporado não é feita no GitHub Pages.

## Endpoint atual
```
https://analyzer-production-8860.up.railway.app
```

## Próximos passos
- validar o serviço com o vídeo Abraão e Isaque;
- calibrar o threshold do FFmpeg;
- gerar miniaturas no backend;
- suportar jobs assíncronos para vídeos maiores;
- adicionar progresso de processamento no servidor.
