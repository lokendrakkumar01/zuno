import { API_URL } from '../config';

const copyToClipboard = async (text) => {
      if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
      }

      const input = document.createElement('input');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      return true;
};

export const shareContentLink = async ({ contentId, title, token }) => {
      const shareUrl = `${window.location.origin}/content/${contentId}`;
      const sharePayload = {
            title: title || 'ZUNO',
            text: title || 'Check this out on ZUNO',
            url: shareUrl
      };

      try {
            if (navigator.share) {
                  await navigator.share(sharePayload);
            } else {
                  await copyToClipboard(shareUrl);
            }
      } catch (error) {
            if (error?.name === 'AbortError') {
                  return { success: false, cancelled: true };
            }
            throw error;
      }

      let shareCount = null;
      try {
            const res = await fetch(`${API_URL}/content/${contentId}/share`, {
                  method: 'POST',
                  headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data.success) {
                  shareCount = data.data?.shareCount ?? null;
            }
      } catch (error) {
            console.error('Failed to sync share count:', error);
      }

      return {
            success: true,
            shareCount,
            message: navigator.share ? 'Shared successfully' : 'Link copied',
            url: shareUrl
      };
};
