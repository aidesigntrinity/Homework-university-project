// Packs the website in docs/ into a single HTML file that opens straight from disk (no server needed).
// Usage: node tools/build-standalone.js [output.html]
const fs = require("fs"), path = require("path");
const DOCS = path.join(__dirname, "..", "docs");
const out = process.argv[2] || path.join(__dirname, "..", "dist", "Due-Board.html");
let html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
const read = (f) => fs.readFileSync(path.join(DOCS, f), "utf8");
const safeJs = (s) => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

html = html.replace('<link rel="stylesheet" href="css/app.css">', () => "<style>\n" + read("css/app.css") + "\n</style>");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => "<script>\n" + safeJs(read(src)) + "\n</script>");
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', "");
html = html.replace('<link rel="apple-touch-icon" href="icon-180.png">\n', "");
html = html.replace('<link rel="icon" href="icon.svg" type="image/svg+xml">', () => '<link rel="icon" href="data:image/svg+xml;base64,' + Buffer.from(read("icon.svg")).toString("base64") + '" type="image/svg+xml">');
if (/<script src=|href="css\//.test(html)) throw new Error("Something was not inlined");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log("Wrote " + out + " (" + Math.round(html.length / 1024) + " KB)");
