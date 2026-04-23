let iosHapticInput = null;
let iosHapticLabel = null;

/**
 * Triggers a haptic feedback using navigator.vibrate on Android 
 * and a hidden checkbox switch trick on iOS 17.4+ Safari.
 * @param {number|number[]} pattern - Vibration duration in ms or pattern array
 */
export const triggerHaptic = (pattern = 40) => {
  // 1. Android / Web Supported
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
    return;
  }

  // 2. iOS Safari Workaround (iOS 17.4+)
  // We use the new `<input type="checkbox" switch>` which triggers a native OS haptic tick when toggled.
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (!iosHapticInput) {
      iosHapticInput = document.createElement('input');
      iosHapticInput.type = 'checkbox';
      iosHapticInput.setAttribute('switch', '');
      iosHapticInput.id = 'ios-haptic-trigger-input';
      
      // Hide the input visually but keep it in the DOM so it remains interactive
      Object.assign(iosHapticInput.style, {
        position: 'absolute',
        opacity: '0',
        pointerEvents: 'none',
        width: '1px',
        height: '1px',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)'
      });
      iosHapticInput.tabIndex = -1;
      
      iosHapticLabel = document.createElement('label');
      iosHapticLabel.htmlFor = 'ios-haptic-trigger-input';
      
      document.body.appendChild(iosHapticInput);
      document.body.appendChild(iosHapticLabel);
    }

    // Programmatically click the label to toggle the switch, which fires the haptic tick
    if (iosHapticLabel) {
      iosHapticLabel.click();
      
      // If it's a pattern (like [20, 50, 20]), trigger a second tick after a short delay
      if (Array.isArray(pattern) && pattern.length > 1) {
        setTimeout(() => {
          iosHapticLabel.click();
        }, pattern[1] || 100);
      }
    }
  }
};
