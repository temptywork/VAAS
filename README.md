# VAAS Development

Install JavaScript dependencies with `npm install`, then start the development server with `npm run dev` at `http://localhost:3000`.

## Local HTTPS

Run `npm run dev:https` to start Vite at `https://localhost:3000`. It generates and caches a self-signed development certificate. Your browser will show a certificate warning the first time; proceed only for this local development server. This is suitable for testing on the same computer, but the generated certificate is not trusted by other devices.

For a trusted local certificate, create one with [mkcert](https://github.com/FiloSottile/mkcert) and configure its paths in `.env.local`:

```sh
mkdir -p .certs
mkcert -install
mkcert -cert-file .certs/localhost.pem -key-file .certs/localhost-key.pem localhost 127.0.0.1 ::1
```

```dotenv
VITE_DEV_TLS_CERT=.certs/localhost.pem
VITE_DEV_TLS_KEY=.certs/localhost-key.pem
```

Then run `npm run dev`. Supplying both certificate paths enables HTTPS automatically. To open VAAS on a phone or another computer, include the development machine's LAN IP or hostname in the certificate and install/trust mkcert's local CA on that device. Keep the private key in `.certs/`; that directory is ignored by Git.


## Camera development setup

Use Node.js 22 or newer. `npm install` installs the JavaScript dependencies and downloads the pinned go2rtc gateway into `.tools/`. To install or replace only the video gateway, run `npm run setup:video`. The installer supports macOS, Windows and Linux; a custom executable can be supplied with `GO2RTC_PATH`.

The ONVIF/RTSP bridge runs inside the Vite development server. `vite build` produces frontend assets; serving those assets by themselves does not provide the camera API or gateway. Restart Vite after changing server-side environment variables.

### ONVIF and RTSP playback

1. Select **ONVIF supported Camera** and enter the camera address, ONVIF port, RTSP port, device-service path and credentials.
2. Discover the camera and choose a standard **H.264** profile. The setup dialog shows resolution, frame rate, bitrate, source bounds, encoder details and PTZ position ranges when the camera reports them.
3. Leave playback on **WebRTC**. The server obtains the RTSP URI through ONVIF and forwards its encoded H.264 video through go2rtc to the browser. Normal WebRTC playback does not use FFmpeg or HLS segments. Audio is not requested.
4. Use the PTZ controls to move the hardware camera. Camera telemetry is polled at up to 10 Hz while moving and approximately 4 Hz while stationary, without overlapping requests.

Plain RTSP input uses the same WebRTC gateway and registration engine, but provides no PTZ telemetry by itself. Webcam and rear-camera inputs also use the shared visual engine. All displayed feeds and captured views preserve source aspect ratio.

HLS remains an explicit compatibility fallback. It requires FFmpeg and adds buffering. On Windows, if CMD finds FFmpeg but PowerShell/Vite does not, set `FFMPEG_PATH` to the full path of `ffmpeg.exe` in `.env.local` and restart Vite; the WebRTC route avoids this dependency.

### PTZ calibration and frame timing

The **Calibrate PTZ anchoring** panel is operated by the user. Collect stopped-camera observations of two fixed, distant landmarks across horizontal movement, vertical movement and two to eight repeatable optical zoom positions. Fit the model, perform the panel's independent landmark checks, then save it. Measurements estimate camera direction conventions, tilt offset, image principal point, radial distortion and focal length at measured zoom positions. Full-circle pan constrains the mechanical pan period; zoom outside the measured range uses visual registration until additional calibration is available.

CP Plus datasheet values are starting values, not a camera-specific calibration. Change starting values for other cameras. Calibration is saved per camera and media profile in this browser. Recalibrate after changes to cropping, digital image geometry or camera mechanics. Same-aspect resolution changes retain normalized anchor geometry; aspect changes require new reference views.

Image stabilization and digital zoom must remain disabled because their changing image warp is not represented by ONVIF pan/tilt/zoom. A fixed image rotation and a known tilt-dependent 180-degree flip rule can be configured in calibration. Unknown automatic flip behavior must be disabled or avoided.

Frame-to-pose matching uses decoded-frame callbacks and a timestamped pose history. **150 ms for WebRTC and 2000 ms for HLS are initial timing estimates**, not measured latency. Set the video delay for the selected transport while viewing actual movement. Separate timing offsets are saved for WebRTC and HLS. Camera status timestamps use a browser-clock offset when they are sufficiently precise; request midpoints remain the fallback. Browser WebRTC capture timestamps must only be enabled after the user confirms that they align with camera exposure time through the gateway; RTP timestamp preservation alone does not establish that alignment.

With a saved calibration and fresh pose, camera geometry drives projection for every saved view. Visual matching searches within the PTZ prediction and adds only a bounded similarity correction. Weak visual support briefly retains that correction, then fades it toward the camera prediction. Stale poses use visual registration; stale visual transforms expire instead of showing indefinitely misplaced overlays. A single camera-rotation model assumes distant landmarks or limited parallax; nearby objects at different depths cannot be made exact by a global image warp.

### Anchor setup and saved scenarios

Capture a view, add its anchor objects, then press **Finish This View** to restore live video. Move the camera and capture another view as needed. Press **Finish Setup & Register** after finishing every captured view. Every anchor retains its own saved-view association; tracking searches a bounded number of views per frame rather than running a separate image-registration pipeline per object.

Re-reference rebases the visible view's anchors and boundaries and discards dependent automatic references. Changing cameras or profiles requires new captured views and re-placement of affected anchors. Boundaries marked for recapture are redrawn using the boundary controls after setup.

New scenario files use normalized source-image coordinates and include native reference dimensions and camera/profile identity. Older files with explicit placement dimensions are converted. Files with missing placement dimensions, missing reference images or unreadable views enter setup and require manual anchor re-placement; the application does not guess their old viewport dimensions.

Registration settings are shared across feed types and saved locally. The Settings panel exposes processing resolution, frame interval, feature and RANSAC limits, pose freshness, visual correction limits, correction hold/fade, view-search budget and automatic-reference limits. Pixel thresholds are expressed at a 960-pixel long edge and scaled to the actual processing image. Background CV accepts one in-flight frame, with no accumulating queue; PTZ projection continues for each sampled frame while CV is busy.

### Local and LAN gateway configuration

For same-computer use, the gateway API and media listener default to loopback. To view VAAS from another LAN device, set the media listener to all interfaces and advertise the development computer's LAN address:

```dotenv
GO2RTC_WEBRTC_HOST=0.0.0.0
GO2RTC_WEBRTC_PORT=8555
GO2RTC_CANDIDATE=192.168.1.20:8555
```

Allow that TCP/UDP media port through the development computer's firewall. Use local HTTPS with a certificate trusted by the viewing device. The go2rtc management API remains loopback-only; the browser negotiates through the same-origin Vite API. Candidate syntax and media ports follow the [go2rtc WebRTC documentation](https://github.com/AlexxIT/go2rtc/tree/v1.9.14#module-webrtc).

Camera configuration and calibration live in browser local storage. Camera credentials are passed to the local server and written to a private per-session gateway configuration, removed when the session closes. Only one network-camera session is active per Vite server; reconnecting replaces its session ID so stale clients cannot stop its replacement.
