# Animartoon — AI Animation Studio

Plataforma estática para organizar produção de animações assistidas por IA.

## Sprint 1.1 — MVP 0.2
- criação e seleção de múltiplos projetos;
- entrada por URL do YouTube ou vídeo local;
- leitura local de duração do vídeo sem upload;
- importação de decupagem em JSON;
- cadastro, edição e exclusão de cenas;
- cadastro de personagens e cenários;
- Próxima ação calculada pelo estado real do projeto;
- prompts distintos para imagem e animação com/sem fala;
- nomes sugeridos com versionamento;
- alerta para cenas acima da duração suportada pelos geradores;
- controle manual do pipeline e aprovação;
- Mapa de Arquivos e Auditoria;
- Gemini, SnapGen, Meta AI, Vibes e Grok;
- escolha de ferramenta preferida por categoria;
- persistência local via localStorage.

## Arquitetura
A aplicação roda inteiramente no navegador e é compatível com GitHub Pages. Nenhuma chave de API de geradores de IA é necessária.

## Próximos passos
- IndexedDB para projetos maiores;
- sincronização Google Drive Online;
- File System Access API para pasta Google Drive local;
- leitura real de nomes/versões de arquivos;
- decupagem automática de vídeo no navegador;
- perfis editáveis de geradores;
- projeto original e inspirado em referência.
