import logging
import os
import shutil
import tempfile
import asyncio
import subprocess
import time
import whisper
from typing import Dict, Any, Optional

logger = logging.getLogger("uvicorn.error")

# Ensure FFmpeg is in PATH for Whisper and subprocess
FFMPEG_WIN_PATH = r"C:\Users\user\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin"
if os.path.exists(FFMPEG_WIN_PATH) and FFMPEG_WIN_PATH not in os.environ.get("PATH", ""):
    os.environ["PATH"] = FFMPEG_WIN_PATH + os.pathsep + os.environ.get("PATH", "")

# Piper TTS Configuration — CLI binary approach (more reliable on Windows than pip package)
# Voice: en_US-amy-medium — conversational tone, ideal for receptionist use case
# Tradeoff: medium quality balances natural prosody with ~1s inference per sentence
PIPER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "piper")
PIPER_EXE = os.path.join(PIPER_DIR, "piper", "piper.exe")
PIPER_MODEL = os.path.join(PIPER_DIR, "voices", "en_US-amy-medium.onnx")

_whisper_model = None

def get_whisper_model():
    """Lazy load lightweight local Whisper model."""
    global _whisper_model
    if _whisper_model is None:
        logger.info("[VOICE] Loading local Whisper model (tiny.en)...")
        _whisper_model = whisper.load_model("tiny.en")
        logger.info("[VOICE] Local Whisper model loaded successfully.")
    return _whisper_model


def _check_piper_available() -> bool:
    """Check if Piper binary and voice model are available."""
    exe_ok = os.path.isfile(PIPER_EXE)
    model_ok = os.path.isfile(PIPER_MODEL) and os.path.getsize(PIPER_MODEL) > 1_000_000
    if not exe_ok:
        logger.warning(f"[VOICE] Piper binary not found at: {PIPER_EXE}")
    if not model_ok:
        logger.warning(f"[VOICE] Piper voice model not found or too small at: {PIPER_MODEL}")
    return exe_ok and model_ok


# Log Piper availability on module load
if _check_piper_available():
    logger.info(f"[VOICE] Piper TTS ready: binary={PIPER_EXE}, model={os.path.basename(PIPER_MODEL)} ({os.path.getsize(PIPER_MODEL) / 1_000_000:.1f} MB)")
else:
    logger.warning("[VOICE] Piper TTS NOT available — falling back to pyttsx3/SAPI5")


class VoiceService:
    """Service layer handling local offline Whisper Speech-to-Text and Piper TTS Speech Synthesis."""

    @classmethod
    def get_ffmpeg_cmd(cls) -> str:
        """Find executable ffmpeg command path."""
        which_path = shutil.which("ffmpeg")
        if which_path:
            return which_path
        exe_path = os.path.join(FFMPEG_WIN_PATH, "ffmpeg.exe")
        if os.path.exists(exe_path):
            return exe_path
        return "ffmpeg"

    @classmethod
    async def transcribe_audio(cls, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        """Normalize uploaded browser audio via FFmpeg to 16kHz mono WAV and transcribe with Whisper."""
        if not audio_bytes or len(audio_bytes) < 100:
            logger.warning("[VOICE] Received empty or too small audio blob (<100 bytes).")
            return ""

        ext = os.path.splitext(filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_in:
            tmp_in.write(audio_bytes)
            tmp_in_path = tmp_in.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
            tmp_wav_path = tmp_wav.name

        logger.info(f"[VOICE] Raw blob size received by backend: {len(audio_bytes)} bytes | filename: '{filename}' | mime_ext: '{ext}'")

        # === DEBUG: Save raw input to persistent debug directory ===
        debug_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "debug_audio")
        os.makedirs(debug_dir, exist_ok=True)
        import datetime
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        debug_raw_path = os.path.join(debug_dir, f"raw_input_{ts}{ext}")
        shutil.copy2(tmp_in_path, debug_raw_path)
        logger.info(f"[VOICE][DEBUG] Saved raw mic input to: {debug_raw_path} ({len(audio_bytes)} bytes)")

        try:
            ffmpeg_bin = cls.get_ffmpeg_cmd()
            # Run FFmpeg conversion: 16kHz, mono 1-channel, 16-bit PCM WAV with volume normalization
            cmd = [
                ffmpeg_bin,
                "-y",
                "-i", tmp_in_path,
                "-ar", "16000",
                "-ac", "1",
                "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                "-c:a", "pcm_s16le",
                tmp_wav_path
            ]
            logger.info(f"[VOICE] FFmpeg command being run: {' '.join(cmd)}")

            loop = asyncio.get_running_loop()
            conv_res = await loop.run_in_executor(
                None,
                lambda: subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            )

            wav_size = os.path.getsize(tmp_wav_path) if os.path.exists(tmp_wav_path) else 0
            logger.info(f"[VOICE] FFmpeg exit code: {conv_res.returncode} | converted WAV size: {wav_size} bytes")
            if conv_res.stderr:
                logger.info(f"[VOICE] FFmpeg stderr: {conv_res.stderr.strip()[:500]}")

            # If loudnorm filter fails for any reason, fallback to basic conversion
            if conv_res.returncode != 0 or wav_size < 100:
                logger.warning("[VOICE] Loudnorm filter failed, falling back to standard PCM conversion...")
                cmd_fallback = [
                    ffmpeg_bin, "-y", "-i", tmp_in_path, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tmp_wav_path
                ]
                conv_res = await loop.run_in_executor(
                    None,
                    lambda: subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                )
                wav_size = os.path.getsize(tmp_wav_path) if os.path.exists(tmp_wav_path) else 0

            # === DEBUG: Save converted WAV and inspect amplitude ===
            debug_wav_path = os.path.join(debug_dir, f"converted_{ts}.wav")
            if os.path.exists(tmp_wav_path) and wav_size > 0:
                shutil.copy2(tmp_wav_path, debug_wav_path)
                logger.info(f"[VOICE][DEBUG] Saved converted WAV to: {debug_wav_path}")

                # Inspect WAV amplitude
                try:
                    import wave
                    import struct as struct_mod
                    with wave.open(debug_wav_path, "rb") as wf:
                        ch = wf.getnchannels()
                        sw = wf.getsampwidth()
                        fr = wf.getframerate()
                        nf = wf.getnframes()
                        dur = nf / fr if fr > 0 else 0
                        raw_frames = wf.readframes(min(nf, fr * 2))  # Read up to 2 seconds
                        if sw == 2 and len(raw_frames) >= 2:
                            samples = struct_mod.unpack(f'<{len(raw_frames)//2}h', raw_frames)
                            max_amp = max(abs(s) for s in samples) if samples else 0
                            rms = (sum(s*s for s in samples) / len(samples)) ** 0.5 if samples else 0
                        else:
                            max_amp = 0
                            rms = 0
                        logger.info(
                            f"[VOICE][DEBUG] Converted WAV properties: "
                            f"channels={ch}, sample_width={sw}, framerate={fr}, "
                            f"frames={nf}, duration={dur:.2f}s, "
                            f"max_amplitude={max_amp}, RMS={rms:.1f} "
                            f"({'HAS AUDIO' if max_amp > 100 else 'SILENT'})"
                        )
                except Exception as e:
                    logger.warning(f"[VOICE][DEBUG] WAV inspection error: {e}")

            target_transcribe_path = tmp_wav_path if (conv_res.returncode == 0 and os.path.exists(tmp_wav_path) and wav_size > 100) else tmp_in_path
            if conv_res.returncode != 0:
                logger.warning(f"[VOICE] FFmpeg conversion warning (code {conv_res.returncode}): {conv_res.stderr.strip()[:200]}. Falling back to original input file.")

            logger.info(f"[VOICE] Handing file '{target_transcribe_path}' ({os.path.getsize(target_transcribe_path)} bytes) to local Whisper model (tiny.en)...")
            model = get_whisper_model()
            t_stt = time.time()
            result = await loop.run_in_executor(
                None,
                lambda: model.transcribe(
                    target_transcribe_path,
                    fp16=False,
                    language="en",
                    initial_prompt="Receptionist appointment customer booking cancellation enquiry"
                )
            )
            stt_latency = time.time() - t_stt

            text = result.get("text", "").strip()
            logger.info(f"[VOICE] Whisper Transcript Result: '{text}' | STT latency: {stt_latency:.2f}s")
            return text

        except Exception as e:
            logger.error(f"[VOICE] Whisper transcription failed: {str(e)}", exc_info=True)
            return ""
        finally:
            for p in (tmp_in_path, tmp_wav_path):
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

    @classmethod
    async def synthesize_speech(cls, text: str) -> bytes:
        """Synthesize text into WAV audio using local Piper TTS (with pyttsx3 fallback)."""
        clean_text = text.strip()
        if not clean_text:
            return b""

        logger.info(f"[VOICE] TTS input: {len(clean_text)} chars | text: '{clean_text[:60]}...'")

        # Try Piper TTS first (much higher quality, natural voice)
        if _check_piper_available():
            return await cls._synthesize_with_piper(clean_text)
        else:
            logger.info("[VOICE] Piper unavailable, falling back to pyttsx3/SAPI5")
            return await cls._synthesize_with_pyttsx3(clean_text)

    @classmethod
    async def _synthesize_with_piper(cls, text: str) -> bytes:
        """Synthesize text using local Piper CLI binary (en_US-amy-medium voice)."""
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp_path = tmp.name

        def _run_piper(input_text: str, output_path: str) -> subprocess.CompletedProcess:
            cmd = [
                PIPER_EXE,
                "--model", PIPER_MODEL,
                "--output_file", output_path,
            ]
            logger.info(f"[VOICE] Piper command: {' '.join(cmd)}")
            return subprocess.run(
                cmd,
                input=input_text,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=30,
            )

        try:
            t_start = time.time()
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, lambda: _run_piper(text, tmp_path))
            tts_latency = time.time() - t_start

            if result.returncode != 0:
                logger.error(f"[VOICE] Piper TTS failed (code {result.returncode}): {result.stderr.strip()[:300]}")
                # Fall back to pyttsx3
                return await cls._synthesize_with_pyttsx3(text)

            if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) < 100:
                logger.error(f"[VOICE] Piper TTS produced no/empty output file")
                return await cls._synthesize_with_pyttsx3(text)

            with open(tmp_path, "rb") as f:
                wav_bytes = f.read()

            # Parse WAV duration from file size (22050 Hz, 16-bit, mono = 44100 bytes/sec + 44 header)
            audio_duration = max(0, (len(wav_bytes) - 44)) / 44100.0
            logger.info(
                f"[VOICE] Piper TTS complete: {len(wav_bytes)} bytes | "
                f"duration: {audio_duration:.2f}s | "
                f"latency: {tts_latency:.2f}s | "
                f"real-time factor: {tts_latency / audio_duration:.2f}x"
                if audio_duration > 0 else
                f"[VOICE] Piper TTS complete: {len(wav_bytes)} bytes | latency: {tts_latency:.2f}s"
            )
            return wav_bytes

        except subprocess.TimeoutExpired:
            logger.error("[VOICE] Piper TTS timed out after 30s, falling back to pyttsx3")
            return await cls._synthesize_with_pyttsx3(text)
        except Exception as e:
            logger.error(f"[VOICE] Piper TTS error: {str(e)}", exc_info=True)
            return await cls._synthesize_with_pyttsx3(text)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    @classmethod
    async def _synthesize_with_pyttsx3(cls, text: str) -> bytes:
        """Fallback TTS: synthesize text using local pyttsx3/SAPI5 engine."""
        import pyttsx3

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp_path = tmp.name

        def _generate_wav(target_path: str, msg: str):
            engine = pyttsx3.init()
            engine.setProperty('rate', 170)
            engine.setProperty('volume', 1.0)
            # Pick a female or clear voice if available
            voices = engine.getProperty('voices')
            for v in voices:
                if "female" in v.name.lower() or "zira" in v.name.lower():
                    engine.setProperty('voice', v.id)
                    break
            engine.save_to_file(msg, target_path)
            engine.runAndWait()

        try:
            t_start = time.time()
            logger.info(f"[VOICE] pyttsx3 fallback: synthesizing {len(text)} chars...")
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: _generate_wav(tmp_path, text))
            tts_latency = time.time() - t_start

            with open(tmp_path, "rb") as f:
                wav_bytes = f.read()
            logger.info(f"[VOICE] pyttsx3 TTS complete: {len(wav_bytes)} bytes | latency: {tts_latency:.2f}s")
            return wav_bytes
        except Exception as e:
            logger.error(f"[VOICE] pyttsx3 TTS failed: {str(e)}", exc_info=True)
            return b""
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
