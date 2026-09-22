# Animartoon — AI Animation Studio

Plataforma estática para organizar produção de animações assistidas por IA.

## Sprint 1.2 — MVP 0.3

Além do fluxo da Sprint 1.1, esta versão implementa o primeiro modo operacional de sincronização de arquivos:

- vínculo de uma pasta local do projeto usando File System Access API;
- compatível com uma pasta sincronizada pelo Google Drive para computador;
- armazenamento do handle autorizado em IndexedDB;
- criação opcional da estrutura padrão de pastas;
- varredura recursiva dos arquivos sem upload;
- reconhecimento automático de `Cnnn_IMG_vNN`, `Cnnn_ANIM_vNN` e `Cnnn_FINAL_vNN`;
- atualização automática do status das cenas a partir dos arquivos encontrados;
- detecção de múltiplas versões de uma mesma etapa;
- escolha da maior versão como versão atual;
- lista de arquivos fora do padrão;
- Mapa Físico de arquivos;
- Auditoria com pendências, cenas acima de 10 s e versões encontradas.

## Estrutura sugerida

```
Projeto/
├── 00_REFERENCIAS/
├── 01_PERSONAGENS/
├── 02_CENARIOS/
├── 03_IMAGENS_CENAS/
├── 04_ANIMACOES/
├── 06_AUDIO/
├── 07_CENAS_FINAIS/
└── 08_EPISODIO_FINAL/
```

## Nomenclatura

```
C001_IMG_v01.png
C001_ANIM_v01.mp4
C001_FINAL_v01.mp4
```

Versões adicionais, como `v02` e `v03`, são tratadas como versões da mesma cena, não como novas cenas.

## Observações

A leitura direta de pastas depende da File System Access API, portanto funciona melhor em navegadores Chromium, como Chrome e Edge, em contexto HTTPS (como GitHub Pages). A aplicação lê apenas os arquivos/pastas que o usuário autoriza.

## Próximos passos

- integração opcional com Google Drive Online;
- IndexedDB para os dados completos dos projetos;
- sincronização periódica configurável;
- análise automática de personagens/cenários por nomes de arquivos;
- decupagem automática de vídeo no navegador;
- perfis editáveis dos geradores;
- suporte futuro a projetos originais e inspirados em referências.
