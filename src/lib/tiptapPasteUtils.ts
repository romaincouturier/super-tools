/** Convert <img alt="🎉"> (email-client emoji wrappers) back to their plain text character. */
export function transformEmojiImageTags(html: string): string {
  return html.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (match, alt) => {
    if (alt && alt.length <= 8 && /[^\x00-\x7F]/.test(alt)) return alt;
    return match;
  });
}
