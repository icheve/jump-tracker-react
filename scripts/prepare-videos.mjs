import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repository = process.env.GITHUB_REPOSITORY || 'icheve/jump-tracker-react';
const releaseTag = process.env.VIDEO_RELEASE_TAG || 'videos-v1';
const outputDir = path.resolve(process.env.VIDEO_OUTPUT_DIR || 'video-output');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const upload = process.env.SKIP_UPLOAD !== '1' && Boolean(process.env.GH_TOKEN);
const limit = Number.parseInt(process.env.VIDEO_LIMIT || '', 10);
const onlyId = process.env.VIDEO_ID || '';
const maxSourceBytes = Number.parseInt(
  process.env.MAX_SOURCE_BYTES || String(200 * 1024 * 1024),
  10,
);

function run(command, args, { capture = false, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';

    if (capture) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      const result = { code: code ?? 1, stdout, stderr };
      if (code === 0 || allowFailure) resolve(result);
      else reject(new Error(`${command} завершился с кодом ${code}${stderr ? `\n${stderr}` : ''}`));
    });
  });
}

async function getDownload(url) {
  const endpoint = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(url)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Яндекс Диск вернул ${response.status} для ${url}`);
  const data = await response.json();
  if (!data.href) throw new Error(`Яндекс Диск не вернул адрес скачивания для ${url}`);
  return data.href;
}

async function getMetadata(url) {
  const endpoint = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(url)}&fields=name,size`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Яндекс Диск вернул ${response.status} для ${url}`);
  const data = await response.json();
  if (!Number.isFinite(data.size)) throw new Error(`Яндекс Диск не вернул размер файла для ${url}`);
  return data;
}

async function ensureRelease() {
  const view = await run(
    'gh',
    ['release', 'view', releaseTag, '--repo', repository, '--json', 'assets'],
    { capture: true, allowFailure: true },
  );

  if (view.code === 0) {
    const release = JSON.parse(view.stdout);
    return new Set(
      release.assets
        .filter((asset) => asset.size > 100_000)
        .map((asset) => asset.name),
    );
  }

  await run('gh', [
    'release', 'create', releaseTag,
    '--repo', repository,
    '--target', process.env.GITHUB_SHA || 'main',
    '--title', 'Видео упражнений',
    '--notes', 'Оптимизированные H.264-копии видео для встроенного плеера приложения.',
    '--draft',
  ]);
  return new Set();
}

async function transcode(sourceUrl, outputPath, index, total) {
  const partialPath = `${outputPath}.part.mp4`;
  await rm(partialPath, { force: true });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const directUrl = await getDownload(sourceUrl);
      console.log(`[${index}/${total}] Кодирование, попытка ${attempt}: ${path.basename(outputPath)}`);
      await run(ffmpeg, [
        '-hide_banner',
        '-nostdin',
        '-loglevel', 'warning',
        '-stats_period', '20',
        '-y',
        '-rw_timeout', '30000000',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', directUrl,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-vf', 'scale=960:960:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '26',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-movflags', '+faststart',
        partialPath,
      ]);
      await run(ffprobe, [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        partialPath,
      ]);
      await rename(partialPath, outputPath);
      return;
    } catch (error) {
      await rm(partialPath, { force: true });
      if (attempt === 3) throw error;
      console.warn(`[${index}/${total}] Повтор после ошибки: ${error.message}`);
    }
  }
}

const source = await readFile(path.resolve('src/data/program.ts'), 'utf8');
let urls = [...new Set(source.match(/https:\/\/disk\.yandex\.ru\/i\/[\w-]+/g) || [])];
if (onlyId) urls = urls.filter((url) => url.endsWith(`/${onlyId}`));
if (Number.isFinite(limit) && limit > 0) urls = urls.slice(0, limit);
if (!urls.length) throw new Error('В program.ts не найдены подходящие видео');

await mkdir(outputDir, { recursive: true });
const existingAssets = upload ? await ensureRelease() : new Set();
let encodedBytes = 0;
let processed = 0;

for (let index = 0; index < urls.length; index += 1) {
  const sourceUrl = urls[index];
  const id = new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1);
  const assetName = `${id}.mp4`;
  const outputPath = path.join(outputDir, assetName);

  if (existingAssets.has(assetName)) {
    console.log(`[${index + 1}/${urls.length}] Уже загружено: ${assetName}`);
    continue;
  }

  const metadata = await getMetadata(sourceUrl);
  if (metadata.size > maxSourceBytes) {
    console.log(
      `[${index + 1}/${urls.length}] Оставлено ссылкой: ${assetName} (${(metadata.size / 1024 / 1024).toFixed(1)} МБ)`,
    );
    continue;
  }

  await transcode(sourceUrl, outputPath, index + 1, urls.length);
  const info = await stat(outputPath);
  encodedBytes += info.size;
  processed += 1;
  console.log(`[${index + 1}/${urls.length}] Готово: ${assetName} (${(info.size / 1024 / 1024).toFixed(1)} МБ)`);

  if (upload) {
    await run('gh', ['release', 'upload', releaseTag, outputPath, '--repo', repository, '--clobber']);
    await rm(outputPath, { force: true });
    existingAssets.add(assetName);
    console.log(`[${index + 1}/${urls.length}] Загружено в GitHub Release`);
  }
}

if (upload) {
  await run('gh', ['release', 'edit', releaseTag, '--repo', repository, '--draft=false']);
}

console.log(`Обработано новых роликов: ${processed}; объём: ${(encodedBytes / 1024 / 1024).toFixed(1)} МБ`);
