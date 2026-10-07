const MAX_SIDE = 2000; // px — plenty for a full-width newsletter photo
const SHRINK_ABOVE = 1.5 * 1024 * 1024; // re-encode files larger than 1.5 MB

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/**
 * Shrink big photos (e.g. straight from a phone) so pages load quickly.
 * GIFs are left alone so animations keep working.
 */
async function prepare(file) {
  if (file.type === 'image/gif') return file;
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && file.size <= SHRINK_ABOVE) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  // PNGs may have transparency → WebP keeps it; photos → JPEG.
  const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
  return blob && blob.size < file.size ? blob : file;
}

/** Upload an image file; resolves to its public URL, e.g. "/uploads/…jpg". */
export async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG, GIF or WebP).');
  const body = await prepare(file);
  const res = await fetch('/api/admin/images', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': body.type || file.type },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.url;
}

/**
 * Upload a video clip (MP4, WebM or MOV, up to 200 MB), reporting progress
 * from 0 to 1. Resolves to its public URL.
 */
export function uploadVideo(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      reject(new Error('Please choose a video file (MP4, WebM or MOV).'));
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      reject(new Error('Videos can be up to 200 MB. Try exporting a shorter or smaller clip.'));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/videos');
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data.url);
      else reject(new Error(data.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    xhr.send(file);
  });
}
