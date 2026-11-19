const { chromium } = require('playwright');
const fs = require('fs');
const { execFileSync } = require('child_process');
(async () => {
  const [key, out, title] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + process.cwd() + '/render/render.html');
  const sg = await p.evaluate(k => ({ bpm: SONGS[k].bpm, bars: SONGS[k].arc.reduce((a, s) => a + s[1], 0) }), key);
  const dur = sg.bars * 4 * 60 / sg.bpm + 4;
  const b64 = await p.evaluate(([k, d]) => Sound.render(k, 2, d), [key, dur]);
  fs.writeFileSync(`render/${key}.raw`, Buffer.from(b64, 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '44100', '-ac', '2', '-i', `render/${key}.raw`,
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '192k',
    '-metadata', `title=${title}`, '-metadata', 'album=Bluefall Soundtrack', out]);
  fs.unlinkSync(`render/${key}.raw`);
  console.log('done', out, Math.round(dur) + 's');
  await b.close();
})();
