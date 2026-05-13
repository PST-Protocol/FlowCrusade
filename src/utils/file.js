export function stripExtension(filename = '') {
  return filename.replace(/\.[^.]+$/, '');
}

export const SUPPORTED_UPLOAD_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.yaml',
  '.yml',
  '.png',
  '.jpg',
  '.jpeg',
  '.jfif',
  '.webp',
  '.bmp',
  '.gif',
  '.tif',
  '.tiff',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/gif',
  'image/tiff',
].join(',');

export function isNativeImageFile(file) {
  if (!file) return false;
  const mimeType = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return mimeType.startsWith('image/') || /\.(png|jpe?g|jfif|webp|bmp|gif|tiff?|apng)$/.test(name);
}

export function getUploadKindLabel(file) {
  return isNativeImageFile(file) ? 'Image' : 'Document';
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read the uploaded file.'));
    reader.readAsDataURL(file);
  });

}
