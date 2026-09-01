import { useCallback } from 'react';

export function useSound() {
  const playBeep = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Softer, lower-pitched "thock" sound
      // Much less piercing than the previous 1200Hz beep
      osc.type = 'sine';
      
      // Start lower (500Hz) and drop slightly (to 300Hz) for a "tap" effect
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
      
      // Softer attack and release to avoid "clicking" artifacts
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  }, []);

  const playSuccess = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      
      // Play a pleasant major third chord
      const playNote = (freq: number, delay: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration + 0.1);
      };

      // Nice "Cash Register" style major chord (C5 - E5)
      playNote(523.25, 0, 0.3); // C5
      playNote(659.25, 0.1, 0.4); // E5
      
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  }, []);

  return { playBeep, playSuccess };
}
