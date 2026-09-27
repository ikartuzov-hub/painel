# Painel de Apoios

**Tudo o que está aberto, num só painel.** Бесплатное живое табло «что сейчас открыто для бизнеса Мадейры»: программы поддержки, дедлайны, семинары недели, мобильность. Каждая строка — с датой сверки и ссылкой на португальский первоисточник. Без аккаунта, без рекламы, без трекеров.

Живое: https://painel.seedwave.pt/ · сделано SeedWave · автор [Igor Kartuzov](https://www.linkedin.com/in/igor-kartuzov/)

## Поверхности
| Файл | Что это |
|---|---|
| `index.html` (+ `/en/ /ru/ /es/ /de/`) | Телефон/десктоп: карта, одометр, фильтр по отрасли, карточки, CTA через Hub, «Переслать» |
| `kiosk.html` | Экран: 5 экранов × 25 с, перекидное табло, QR, офлайн. `?n=&l=&p=&c=&src=`, `?s=open|soon|seminars|mobility|changes` — закрепить экран |
| `print.html` | Лист недели A4 |
| `embed.html` | Виджет для iframe |
| `setup.html` | «Criar o seu painel»: название → язык → отрасль → цвет → 3 ссылки + QR |
| `flyer.html` (+ языки) | Листовка |

## Три слоя
- **Движок:** `painel.js` (+ `painel.css`, `tokens.css`) — не знает ни языка, ни программ.
- **Локали:** `ui.{pt,en,ru,es,de}.json`.
- **Контент:** `data/programs.json`, `data/seminars.json`, `data/meta.json` — снимок сенсора субсидий и радара семинаров (Notion). Публикуется только Ур.1, контур B — никогда, сырое поле «Условия» — никогда.
- **Реестр:** `manifest.json` → `registry.js` (адрес сайта, Hub, мосты).

## Сборка
```
python3 _src/build.py      # registry.js → пререндер 10 адресов → чек-лист (7 проверок + правила доверия)
python3 _src/mkicons.py    # иконки телефона и OG-превью
```
Правка страниц `index.html` / `flyer.html` — в `_src/pages/`, корень перезаписывается пререндером.
