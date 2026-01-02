export function useAudioPermission() {
  const request = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      return false;
    }
  };

  return { request };
}
