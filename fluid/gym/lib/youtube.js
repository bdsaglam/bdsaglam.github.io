/**
 * fl-youtube: a YouTube player that tells the agent where the user is in the video. Its position
 * reaches the agent with the user's next prompt, so "what does he mean here?" needs no timestamp.
 * It reports when the user plays, pauses, or seeks, and every 15 seconds while playing.
 *
 * It is also a clock for a director's flow: it publishes its position with fluid.clock, so beats
 * and time cues fire on time, and logs video.play, video.pause, video.end {video, at} and
 * video.seek {video, from, to} to the session event log.
 *
 * Attributes:
 *   video    string   YouTube URL or 11-character video id
 *   start    number   seconds to start at; change it to jump the player there
 *   clock    string   the clock name the flow's anchors use; default "video"
 *
 * To answer about the video, fetch its transcript (the youtube-transcript skill) into
 * .fluid/sources/youtube-<id>.md; the agent's canvas context names that file.
 *
 * Example:
 *   <script src="../../lib/youtube.js"></script>
 *   <fl-youtube video="AD4b-52jtos" start="754"></fl-youtube>
 */
(() => {
  if (customElements.get('fl-youtube')) return;
  if (!window.fluid) {
    const s = document.createElement('script');
    s.src = '../../lib/fluid.js';
    document.head.append(s);
  }

  let apiReady;
  const loadApi = () => apiReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  const idOf = (s) => (String(s || '').match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || [])[1]
    || (/^[\w-]{11}$/.test(String(s || '').trim()) ? String(s).trim() : '');
  const STATES = { 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' };

  class FlYoutube extends HTMLElement {
    static observedAttributes = ['video', 'start'];

    connectedCallback() {
      this.style.display ||= 'block';
      this.style.position = 'relative';
      if (!this.style.height) this.style.height = '100%';
      this.innerHTML = '<div style="position:absolute;inset:0"></div>';
      this.build();
    }

    disconnectedCallback() {
      clearInterval(this._tick);
      clearInterval(this._clock);
      this.player?.destroy?.();
      this.player = null;
    }

    attributeChangedCallback(name, old, now) {
      if (!this.isConnected || old === now) return;
      if (name === 'video') this.build();
      else if (name === 'start' && this.player?.seekTo) this.player.seekTo(Number(now) || 0, true);
    }

    async build() {
      const id = idOf(this.getAttribute('video'));
      const box = this.firstElementChild;
      if (!id) { box.textContent = 'fl-youtube: no video id'; return; }
      this.player?.destroy?.();
      await loadApi();
      const mount = document.createElement('div');
      box.replaceChildren(mount);
      this._id = id;
      this.player = new YT.Player(mount, {
        width: '100%', height: '100%', videoId: id,
        playerVars: { start: Math.floor(Number(this.getAttribute('start')) || 0), rel: 0, playsinline: 1, origin: location.origin },
        events: { onStateChange: (e) => this.changed(e.data) },
      });
      clearInterval(this._clock);
      this._last = null;
      this._clock = setInterval(() => this.tickClock(), 250);
    }

    // Publish the position as a clock (fluid.clock throttles), and log a jump as one video.seek.
    tickClock() {
      const t = this.player?.getCurrentTime?.();
      if (typeof t !== 'number' || !window.fluid?.clock) return;
      window.fluid.clock(t, this.getAttribute('clock') || 'video');
      const now = performance.now();
      if (this._last) {
        const expected = this._last.t + (this._playing ? (now - this._last.at) / 1000 : 0);
        if (Math.abs(t - expected) > 2) {
          window.fluid.emit('video.seek', { video: this._id, from: Math.round(this._last.t), to: Math.round(t) }).catch(() => {});
        }
      }
      this._last = { t, at: now };
    }

    changed(code) {
      const state = STATES[code];
      clearInterval(this._tick);
      this._playing = state === 'playing';
      const kind = { playing: 'video.play', paused: 'video.pause', ended: 'video.end' }[state];
      const at = this.player?.getCurrentTime?.();
      if (kind && window.fluid?.emit) window.fluid.emit(kind, { video: this._id, at: Math.round(at || 0) }).catch(() => {});
      if (state === 'playing') this._tick = setInterval(() => this.report('playing'), 15000);
      if (state && state !== 'buffering' && state !== 'cued') this.report(state);
    }

    report(state) {
      const t = this.player?.getCurrentTime?.();
      if (typeof t !== 'number' || !window.fluid?.action) return;
      const title = this.player.getVideoData?.().title || undefined;
      window.fluid.action({ type: 'video', video: this._id, pos: Math.round(t), state, title }).catch(() => {});
    }
  }
  customElements.define('fl-youtube', FlYoutube);
})();
