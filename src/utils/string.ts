export const padLeftZero = (string: number) => {
  return `${string}`.length === 1 ? `0${string}` : `${string}`;
};

export const makeBasicAuth = (clientId: string, clientSecret: string) => {
  const authString = `${encodeURI(clientId)}:${encodeURI(clientSecret)}`;
  return Buffer.from(authString).toString("base64");
};

export const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
