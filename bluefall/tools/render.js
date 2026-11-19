const { chromium } = require('playwright');
const fs = require('fs');
const { execFileSync } = require('child_process');
const list = [
  ['menu', 0, '00 Main Menu'], ['drive', 2, '01 Endless'], ['chaos', 2, '02 Chaos'],
  ['l1', 2, '03 Level 1 - Midnight On-Ramp'], ['l2', 2, '04 Level 2 - Glass Highway'], ['l3', 2, '05 Level 3 - Pinball District'],
  ['l4', 2, '06 Level 4 - Sunset Slide'], ['l5', 2, '07 Level 5 - The Foundry'], ['l6', 2, '08 Level 6 - Rockfall Canyon'],
  ['l7', 2, '09 Level 7 - Laser Arcade'], ['l8', 2, '10 Level 8 - Meltdown']
];
(async () => {
  const todo = list.filter(([, , name]) => !fs.existsSync(`songs/${name}.mp3`));
  const workers = Math.max(1, Math.min(todo.length, +process.argv[2] || 4));
  const runOne = async ([key, lvl, name]) => {
    const b = await chromium.launch();
    const p = await b.newPage();
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto('file://' + process.cwd() + '/render/render.html');
    const bpm = await p.evaluate(k => SONGS[k].bpm, key);
    const bars = lvl === 2 ? 46 : 32;
    const dur = bars * 4 * 60 / bpm + 6;
    const b64 = await p.evaluate(([k, l, d]) => Sound.render(k, l, d), [key, lvl, dur]);
    const raw = `render/${key}.raw`;
    fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '44100', '-ac', '2', '-i', raw,
      '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '192k',
      '-metadata', `title=${name.replace(/^\d+ /, '')}`, '-metadata', 'album=Bluefall Soundtrack', `songs/${name}.mp3`]);
    fs.unlinkSync(raw);
    console.log(name, Math.round(dur) + 's', bpm + ' bpm');
    await b.close();
  };
  const queue = todo.slice();
  await Promise.all(Array.from({ length: workers }, async () => { while (queue.length) await runOne(queue.shift()); }));
})();
