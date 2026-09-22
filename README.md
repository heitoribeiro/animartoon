# Animartoon — AI Animation Studio

## Sprint 1.8 — MVP 0.9

A plataforma agora passa a tratar explicitamente **quem está falando** e a continuidade entre subcenas técnicas.

### Personagem falante
Cada cena pode ter um campo `speaker`.

Quando a cena possui diálogo, esse personagem é incluído no prompt de animação como o personagem que deve receber a sincronização labial. Isso evita que personagens secundários sejam animados como se estivessem falando.

Na importação de SRT/VTT:
- se a cena tiver apenas um personagem cadastrado, ele é sugerido automaticamente como falante;
- cenas com mais de um personagem continuam exigindo revisão humana.

A edição em massa também permite definir o falante para várias cenas ao mesmo tempo.

### Continuidade entre subcenas A/B/C
Quando uma cena longa foi dividida tecnicamente em partes como:

```
C086A
C086B
C086C
```

a tela **Detalhes** oferece **Propagar continuidade**.

A ação replica para as subcenas do mesmo grupo:
- personagens;
- cenário;
- personagem falante;
- câmera;
- som ambiente;
- direção de ação quando ainda não preenchida.

Também grava uma nota automática de continuidade para que o prompt peça a manutenção de:
- aparência;
- posição dos personagens;
- iluminação;
- ambiente;
- lógica de câmera.

### Auditoria
A página Auditoria agora também identifica cenas de diálogo com texto preenchido, mas sem personagem falante definido.

## Próximos passos
- associação assistida do falante usando padrões do roteiro;
- continuidade visual com miniaturas da cena anterior;
- pesquisa textual por fala/personagem/cenário;
- perfis dos geradores editáveis;
- iniciar modo Projeto Original.
