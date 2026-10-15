export function startNavigationProgress() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('finance:navigation-start'));
  }
}
