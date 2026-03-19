export const toUserNameSlug = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-user';
};

export const buildDtrDocumentId = ({ dateKey, userName, userId }) => {
  return `${dateKey}_${toUserNameSlug(userName)}_${userId}`;
};
