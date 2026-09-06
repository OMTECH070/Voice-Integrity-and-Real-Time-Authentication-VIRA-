# Voice liveness (AI-voice-detection) module

Answers one question for a chunk of speech audio: "how likely is this to
be a synthetic/spoofed voice rather than a live human one?" Nothing more
— it doesn't do VAD (that's `client/src/audio/vad/`, upstream of this),
doesn't transcribe (Whisper isn't part of this feature at all — spoof
detection and transcription are unrelated tasks), and doesn't know about
subscriptions or billing. Where it's called from, and whether the caller
is entitled to call it, is a decision for that caller, not for this
module.

## What's real right now vs. what's a stub

**Real and tested (no model weights needed):**
- `chunkBuffer.ts` — accumulates gated speech PCM into fixed-duration
  (~2-3s) windows. Anti-spoof/speaker models need real audio context,
  unlike the VAD's 20ms frames.
- `resample.ts` — linear resample to the model's expected rate (16kHz).
- `VoiceLivenessAnalyzer.ts` — orchestrates buffering → resampling →
  backend call → result event, with error isolation (one bad chunk
  doesn't kill the stream).
- `adapters/mockBackend.ts` — `NotConfiguredBackend` (throws clearly,
  never fakes a score) and `MockVoiceLivenessBackend` (deterministic
  fake, for tests only — never point this at a real user).

**Wired but needs your own model files:**
- `adapters/onnxNodeBackend.ts` — real ONNX Runtime inference, CPU-only
  (no GPU needed — this is what makes free hosting on a plain Render
  instance realistic). This does NOT ship any model weights. Until you
  supply real `.onnx` files, `InferenceSession.create()` will reject
  with a file-not-found error the first time it runs. That's expected,
  not a bug.

## Getting real models

You need two things, both exported to ONNX:

1. **Anti-spoof classifier** (does the actual "AI or not" scoring). The
   standard open-source baselines, trained on the ASVspoof dataset, are
   **AASIST** and **RawNet2** — search for their public GitHub repos and
   pretrained checkpoints, then export the checkpoint to ONNX (usually
   `torch.onnx.export(...)` if it's a PyTorch checkpoint).
2. **Speaker embedding (ECAPA-TDNN)** — optional, only needed if you
   want the embedding output (e.g. for "is this the same voice as
   earlier in the call"). SpeechBrain's `spkrec-ecapa-voxceleb` is the
   common pretrained choice; same ONNX export step.

**Before wiring a checkpoint in**, inspect its actual input/output
tensor names — they vary by export tool and are not guessed by this
code. [Netron](https://netron.app) (open the `.onnx` file in your
browser, no install) is the easiest way to see them. Then set
`antispoofInputName` / `antispoofOutputName` (and the ecapa equivalents)
in `OnnxNodeBackendConfig` to match.

```ts
import { OnnxNodeVoiceLivenessBackend, VoiceLivenessAnalyzer } from "./voiceLiveness";

const backend = new OnnxNodeVoiceLivenessBackend({
  antispoofModelPath: "/models/aasist.onnx",
  antispoofInputName: "input",   // check with Netron
  antispoofOutputName: "output", // check with Netron
  ecapaModelPath: "/models/ecapa.onnx", // omit if you don't need embeddings
});

const analyzer = new VoiceLivenessAnalyzer(backend, {
  onResult: (result) => {
    // result.spoofScore: 0..1, result.label: "live" | "likely-synthetic" | "uncertain"
  },
  onError: (err) => {
    // one bad chunk — log it, keep going
  },
});
```

## Installing onnxruntime-node

```bash
npm install onnxruntime-node
```

This module was scaffolded in a sandboxed environment that couldn't
reach `api.nuget.org` (where the native binary postinstall step
downloads from), so the install couldn't be verified there. It should
work fine on a normal machine, CI, or Render — the package itself is on
the standard npm registry, only its postinstall step needs nuget.org
reachability. Once it installs successfully, **delete
`adapters/onnxruntime-node-ambient.d.ts`** — that file only exists to
let this module typecheck without the real package installed, and the
real package's own types are far more complete.

## Real-time framing: this needs ~2-3 seconds per score, not milliseconds

Unlike the VAD (a decision every ~20ms), a spoof/speaker model needs
real audio context to be reliable. `chunkDurationMs` (default 2500ms)
controls this. A live badge that updates every 2-3 seconds during a call
is a reasonable, honest version of "real-time" for this kind of model —
don't expect (or promise users) sub-second latency without a fundamentally
different, GPU-backed approach.

## A key architecture decision this module does NOT make for you

**VIRA's WebRTC is currently pure peer-to-peer — audio never touches the
server** (see the comment in `server/src/sockets/webrtc.socket.ts`: it
only relays SDP/ICE signaling, never media). This module assumes it's
being fed PCM samples, but *how those samples get to it* is an open
question with two real options:

1. **Analyze client-side.** Run this same buffering/resampling logic
   against the *remote* peer's `MediaStream` (from
   `RTCPeerConnection.ontrack`, not the local mic) in the browser, using
   `onnxruntime-web` (WASM) instead of `onnxruntime-node`. No audio ever
   leaves the browser. This fits your current P2P architecture without
   any changes to it.
2. **Route audio to the server.** Requires changing the call
   architecture so the server receives a media stream (not just
   signaling) — a bigger, separate change, and one that needs sign-off
   given it touches shared call/WebRTC code.

This module's core (`chunkBuffer.ts`, `resample.ts`,
`VoiceLivenessAnalyzer.ts`) is written with zero Node-specific
dependencies for exactly this reason — it can run unmodified in either
location. Only the backend adapter differs (`onnxNodeBackend.ts` for
server-side Node, a future `onnxWebBackend.ts` for client-side browser).
**This is a real architecture decision, not a detail — it changes which
folder this code ultimately lives in and what socket contract wraps it.**
Flag it before building the socket-facing layer.

## What's intentionally NOT here yet

- Any socket/transport wiring (`*.socket.ts`) — deliberately not
  included, since the client-vs-server placement above needs to be
  settled first, and touching `webrtc.socket.ts` is a shared file per
  your project's rules.
- Subscription/entitlement gating — separate system, separate
  sign-off, per your project's own rules.
- `onnxWebBackend.ts` — the browser-side counterpart to
  `onnxNodeBackend.ts`, for if you pick option 1 above.
