// Icon generator for DevDash — indigo-themed dashboard sparkline
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function makeIcon(size, savePath) {
  const png = new PNG({ width: size, height: size, colorType: 6 });

  // Palette (indigo/violet)
  const bg1 = [15, 15, 32];       // #0f0f20
  const bg2 = [30, 27, 75];       // #1e1b4b
  const bar1 = [129, 140, 248];   // indigo-400
  const bar2 = [139, 92, 246];    // violet-500
  const bar3 = [99, 102, 241];    // indigo-500

  // Three stacked horizontal bars resembling a dashboard sparkline.
  // We'll draw rounded rects over a dark rounded square.

  const radius = Math.max(2, size * 0.18);

  // Bar heights (relative)
  const barCount = 3;
  const barH = size * 0.14;
  const barGap = size * 0.08;
  const contentH = barCount * barH + (barCount - 1) * barGap;
  const startY = (size - contentH) / 2;

  // Bar widths vary to look like a sparkline / chart
  const bars = [
    { y: startY + 0 * (barH + barGap), w: size * 0.62, color: bar1 },
    { y: startY + 1 * (barH + barGap), w: size * 0.44, color: bar2 },
    { y: startY + 2 * (barH + barGap), w: size * 0.74, color: bar3 },
  ];

  const leftPad = size * 0.18;
  const barRadius = Math.max(1, barH * 0.35);

  function inRoundedRect(px, py, rx, ry, rw, rh, rr) {
    if (px < rx || px > rx + rw || py < ry || py > ry + rh) return false;
    const cx1 = rx + rr;
    const cy1 = ry + rr;
    const cx2 = rx + rw - rr;
    const cy2 = ry + rh - rr;
    // corner regions
    if (px < cx1 && py < cy1) return (px - cx1) ** 2 + (py - cy1) ** 2 <= rr * rr;
    if (px > cx2 && py < cy1) return (px - cx2) ** 2 + (py - cy1) ** 2 <= rr * rr;
    if (px < cx1 && py > cy2) return (px - cx1) ** 2 + (py - cy2) ** 2 <= rr * rr;
    if (px > cx2 && py > cy2) return (px - cx2) ** 2 + (py - cy2) ** 2 <= rr * rr;
    return true;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      let r = 0, g = 0, b = 0, a = 0;

      // Background rounded square
      if (inRoundedRect(x, y, 0, 0, size, size, radius)) {
        // vertical gradient
        const t = y / size;
        r = Math.round(bg1[0] + (bg2[0] - bg1[0]) * t);
        g = Math.round(bg1[1] + (bg2[1] - bg1[1]) * t);
        b = Math.round(bg1[2] + (bg2[2] - bg1[2]) * t);
        a = 255;
      }

      // Bars on top
      for (const bar of bars) {
        if (inRoundedRect(x, y, leftPad, bar.y, bar.w, barH, barRadius)) {
          // Slight gradient inside each bar for depth
          const tx = (x - leftPad) / bar.w;
          const shade = 0.85 + 0.15 * Math.cos(tx * Math.PI);
          r = Math.round(bar.color[0] * shade);
          g = Math.round(bar.color[1] * shade);
          b = Math.round(bar.color[2] * shade);
          a = 255;
        }
      }

      png.data[idx]     = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  const buf = PNG.sync.write(png);
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  fs.writeFileSync(savePath, buf);
  console.log(`wrote ${savePath} (${size}x${size}, ${buf.length} bytes)`);
}

const root = path.resolve(__dirname, '..');
makeIcon(16, path.join(root, 'src', 'assets', 'tray.png'));
makeIcon(32, path.join(root, 'src', 'assets', 'tray@2x.png'));
makeIcon(256, path.join(root, 'build', 'icon.png'));
makeIcon(512, path.join(root, 'build', 'icon@2x.png'));
console.log('DevDash icons generated.');
