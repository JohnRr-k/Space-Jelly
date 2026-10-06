# Russ Arcade (portfolio)

A static, single-page portfolio built around Space Jelly. No build step.

- `index.html` – the whole site (HTML, CSS, JS inline). Open it directly in a browser.
- `assets/` – web-optimized copies of the game's sprites from `Space Jelly Russell/Assets/Sprite`.

The hero and the Tuning Lab run a browser port of the game that uses the values from the
Unity `Game` scene (gravity scale 0.65, flap velocity 3, tilt 5, pipe speed 2, spawn every 2 s).

To add contact links, fill in the `CONTACT` object at the top of the `<script>` in `index.html`.

To host it on GitHub Pages: Settings → Pages → deploy from branch, folder `/` and visit `/portfolio/`.
