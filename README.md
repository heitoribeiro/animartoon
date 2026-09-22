# Animartoon — AI Animation Studio

Plataforma estática para organizar produção de animações assistidas por IA.

## Sprint 1.3 — MVP 0.4

Esta versão amplia a sincronização e mantém a aplicação sem backend obrigatório.

### Sincronização automática
- modos: manual, 30 segundos, 1 minuto e 5 minutos;
- funciona enquanto a página estiver aberta;
- no modo Google Drive no computador, reaproveita a pasta autorizada quando a permissão continua válida;
- no modo Google Drive Online, reaproveita a sessão OAuth enquanto o token estiver ativo.

### Google Drive Online opcional
- configuração de OAuth Client ID diretamente no projeto;
- o OAuth Client ID é público e não equivale a uma chave secreta dos geradores de IA;
- conexão pelo Google Identity Services no navegador;
- escopo utilizado: `drive.metadata.readonly`;
- leitura recursiva de nomes e metadados de arquivos da pasta escolhida;
- a pasta pode ser informada por link ou ID;
- nenhum vídeo ou imagem é enviado para a Animartoon;
- a plataforma usa apenas os metadados para atualizar o andamento do projeto.

### Modos de armazenamento
- Google Drive Online;
- Google Drive no computador;
- Controle manual.

### Reconhecimento de arquivos
```
C001_IMG_v01.png
C001_ANIM_v01.mp4
C001_FINAL_v01.mp4
```

Versões adicionais, como `v02` e `v03`, são agrupadas como versões da mesma etapa.

## Observações sobre o Google Drive Online

Para usar o modo online é necessário criar um **OAuth Client ID para aplicação Web** no Google Cloud e autorizar a URL publicada da Animartoon como origem JavaScript. Não é necessário guardar client secret no front-end.

O token de acesso é mantido somente em memória na sessão atual do navegador e não é gravado no projeto.

## Estrutura local sugerida

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

## Próximos passos
- criação assistida da estrutura de pastas no Drive Online;
- perfis editáveis dos geradores;
- sincronização de personagens e cenários pelos nomes dos arquivos;
- IndexedDB para dados completos dos projetos;
- decupagem automática no navegador;
- projetos originais e inspirados em referências.
