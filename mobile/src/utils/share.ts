import { Platform, Share as RNShare } from "react-native";

/**
 * Share a URL (+ optional caption) reliably on both platforms.
 *
 * Android's share intent has no separate URL field — RN's `Share.share`
 * drops the `url` param there and shares only `message`. So on Android the
 * URL is placed FIRST in the message text (which also lets targets like
 * WhatsApp render the link-preview card); iOS keeps the native url param
 * with the caption as the message.
 */
export async function shareLink(url: string, caption?: string): Promise<void> {
  if (Platform.OS === "android") {
    await RNShare.share({
      message: caption ? `${url}\n${caption}` : url,
    });
    return;
  }
  await RNShare.share({
    url,
    message: caption ?? url,
  });
}
