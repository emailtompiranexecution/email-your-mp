# How to add or edit people

All the people shown on the site come from **`people.json`**. Edit that one file.

Each person is one line:

```json
{ "name": "Full Name", "status": "executed", "photo": "", "age": "", "note": "" }
```

- **name** — the name shown under the photo.
- **status** — either `"executed"` or `"risk"` (risk = at risk of execution).
- **photo** — the image file name inside the `photo` folder, e.g. `"Peyman Ganji.jpg"`.
  Leave it as `""` if you don't have a photo — the site shows a neutral silhouette.
- **age** — their age as a number in quotes, e.g. `"20"`. Leave `""` if unknown.
- **note** — one short sentence about them / their case (shown on the people page).
  Leave `""` if none. Keep it factual and sourced.

## To add a person
Add a new line to the list (don't forget the comma between entries):

```json
{ "name": "New Person", "status": "risk", "photo": "" }
```

## To add their photo later
1. Drop the image file into the `photo` folder.
2. Put its file name in that person's `"photo"` field.

(If you drop a photo into the folder and it isn't listed in `people.json`, it is
added automatically, with the name/status taken from the file name, e.g.
`Name-executed.jpg`.)

## After editing
Once you commit/save, the site rebuilds automatically. `photos.json` is generated
from `people.json` + the photo folder — you do **not** edit `photos.json` by hand.

**Important:** only add people already named publicly by reputable human-rights
organisations (Amnesty International, Iran Human Rights, Hengaw, HRANA), and
re-check their status before publishing.
