const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SVG_PATH = path.join(__dirname, '..', 'public', 'icon.svg');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android icon sizes
const ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Adaptive icon foreground (108dp with 66dp icon in center)
const ADAPTIVE_FG_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

// Splash screen sizes for common devices
const SPLASH_SIZES = {
  'drawable-port-ldpi': [200, 320],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
};

async function generate() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Generate launcher icons
  for (const [folder, size] of Object.entries(ICON_SIZES)) {
    const dir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(dir, { recursive: true });
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));
    console.log(`Generated ${folder}/ic_launcher.png (${size}x${size})`);
  }

  // Generate adaptive icon foregrounds
  for (const [folder, size] of Object.entries(ADAPTIVE_FG_SIZES)) {
    const dir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(dir, { recursive: true });

    // Create foreground with padding (108dp icon, 66dp content centered = ~61% of total)
    const contentSize = Math.round(size * 0.61);
    const padding = Math.round((size - contentSize) / 2);

    const resizedIcon = await sharp(svgBuffer)
      .resize(contentSize, contentSize)
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 22, g: 119, b: 255, alpha: 255 },
      },
    })
      .composite([{ input: resizedIcon, left: padding, top: padding }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));
    console.log(`Generated ${folder}/ic_launcher_foreground.png (${size}x${size})`);
  }

  // Generate splash screens (blue gradient background + icon centered)
  for (const [folder, [w, h]] of Object.entries(SPLASH_SIZES)) {
    const dir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(dir, { recursive: true });

    const iconSize = Math.round(Math.min(w, h) * 0.25);
    const resizedIcon = await sharp(svgBuffer)
      .resize(iconSize, iconSize)
      .png()
      .toBuffer();

    // Create blue gradient background
    const svgBg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e"/>
        <stop offset="50%" style="stop-color:#16213e"/>
        <stop offset="100%" style="stop-color:#0f3460"/>
      </linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
    </svg>`;

    const left = Math.round((w - iconSize) / 2);
    const top = Math.round((h - iconSize) / 2);

    await sharp(Buffer.from(svgBg))
      .composite([{ input: resizedIcon, left, top }])
      .png()
      .toFile(path.join(dir, 'splash.png'));
    console.log(`Generated ${folder}/splash.png (${w}x${h})`);
  }

  // Also save a 1024x1024 icon to public for web use
  const publicDir = path.join(__dirname, '..', 'public');
  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(publicDir, 'icon.png'));
  console.log('Generated public/icon.png (1024x1024)');

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
