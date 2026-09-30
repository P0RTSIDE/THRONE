# THRONE

A full-viewport browser piece: a wheel within a wheel, with synthesized sound, a calm mode, and text that changes as the viewer moves through it. It is built to be stood in front of, not scanned like a document.

## Run locally

ES modules do not load from a `file://` URL. Serve the folder over HTTP, then open the printed address.

```bash
python -m http.server 8080
```

Open http://localhost:8080.

Calm Mode and mute stay in the corner. If the operating system requests reduced motion, Calm Mode starts on.

## Stack

HTML, CSS, and JavaScript. Three.js is vendored at `vendor/three.module.js`. Scene code is split across `js/` (`throne.js`, `eyeWheel.js`, `audioEngine.js`, `calmMode.js`, and related modules). `index.html` is the page shell.
