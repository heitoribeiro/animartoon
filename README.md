# Animartoon — AI Animation Studio

Plataforma estática para organizar produção de animações assistidas por IA.

## Sprint 1.4 — MVP 0.5

Esta versão passa a reconhecer também referências de **personagens** e **cenários** nos arquivos sincronizados, além dos arquivos de cenas.

### Personagens
Padrão sugerido:

```
ABRAHAM_01_FRONT.png
ABRAHAM_01_3Q.png
ABRAHAM_01_SIDE.png
ABRAHAM_01_BACK.png
```

A página Personagens passa a indicar quais vistas foram localizadas.

### Cenários
Padrão sugerido:

```
CAMP_OASIS_01_BASE.png
CAMP_OASIS_01_WIDE.png
CAMP_OASIS_01_DETAIL.png
```

A página Cenários passa a indicar quais referências foram encontradas.

### Auditoria
A auditoria agora também aponta:
- personagens cadastrados sem arquivo detectado;
- cenários cadastrados sem arquivo detectado;
- cenas sem imagem, animação ou aprovação;
- arquivos fora do padrão;
- múltiplas versões;
- cenas acima de 10 segundos.

### Mapa de Arquivos
O progresso de Personagens e Cenários deixa de considerar apenas o cadastro lógico. Agora ele pode ser alimentado pela presença real das referências encontradas no armazenamento sincronizado.

## Padrões atuais

```
01_PERSONAGENS/ABRAHAM_01_FRONT.png
02_CENARIOS/CAMP_OASIS_01_BASE.png
03_IMAGENS_CENAS/C001_IMG_v01.png
04_ANIMACOES/C001_ANIM_v01.mp4
07_CENAS_FINAIS/C001_FINAL_v01.mp4
```

## Próximos passos
- primeira decupagem automática de vídeo no navegador;
- sugestão de divisão de cenas acima do limite do gerador;
- cadastro de fala, ação e câmera por cena;
- perfis editáveis dos geradores;
- suporte a projetos originais e inspirados em referências.
