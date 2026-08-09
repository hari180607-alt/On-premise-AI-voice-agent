import logging
import os
import shutil
import tempfile
import asyncio
import subprocess
import pyttsx3
import whisper
from typing import Dict, Any, Optional

logger = logging.getLogger("uvicorn.error")

# Ensure FFmpeg is in PATH for Whisper and subprocess
FFMPEG_WIN_PATH = r"C:\Users\user\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin"
if os.path.exists(FFMPEG_WIN_PATH) and FFMPEG_WIN_PATH not in os.environ.get("PATH", ""):
    os.environ["PATH"] = FFMPEG_WIN_PATH + os.pathsep + os.environ.get("PATH", "")

_whisper_model = None

def get_whisper_model():
    """Lazy load lightweight local Whisper model."""
    global _whisper_model
    if _whisper_model is None:
        logger.info("[VOICE] Loading local Whisper model (tiny.en)...")
        _whisper_model = whisper.load_model("tiny.en")
        logger.info("[VOICE] Local Whisper model loaded successfully.")
    return _whisper_model


class VoiceService:
    """Service layer handling local offline Whisper Speech-to-Text and TTS Speech Synthesis."""

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

        try:
            ffmpeg_bin = cls.get_ffmpeg_cmd()
            # Run FFmpeg conversion: 16kHz, mono 1-channel, 16-bit PCM WAV
            cmd = [
                ffmpeg_bin,
                "-y",
                "-i", tmp_in_path,
                "-ar", "16000",
                "-ac", "1",
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
            logger.info(f"[VOICE] FFmpeg converted WAV path: '{tmp_wav_path}' | size: {wav_size} bytes | exit code: {conv_res.returncode}")

            target_transcribe_path = tmp_wav_path if (conv_res.returncode == 0 and os.path.exists(tmp_wav_path) and wav_size > 100) else tmp_in_path
            if conv_res.returncode != 0:
                logger.warning(f"[VOICE] FFmpeg conversion warning (code {conv_res.returncode}): {conv_res.stderr.strip()[:200]}. Falling back to original input file.")

            logger.info(f"[VOICE] Handing file '{target_transcribe_path}' ({os.path.getsize(target_transcribe_path)} bytes) to local Whisper model (tiny.en)...")
            model = get_whisper_model()
            result = await loop.run_in_executor(
                None,
                lambda: model.transcribe(target_transcribe_path, fp16=False)
            )

            text = result.get("text", "").strip()
            logger.info(f"[VOICE] Whisper Transcript Result: '{text}'")
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
        """Synthesize text into WAV audio using local pyttsx3 offline engine."""
        clean_text = text.strip()
        if not clean_text:
            return b""

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
            logger.info(f"[VOICE] Synthesizing TTS audio ({len(clean_text)} chars): '{clean_text[:40]}...'")
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: _generate_wav(tmp_path, clean_text))

            with open(tmp_path, "rb") as f:
                wav_bytes = f.read()
            logger.info(f"[VOICE] TTS Synthesis complete: {len(wav_bytes)} WAV bytes generated.")
            return wav_bytes
        except Exception as e:
            logger.error(f"[VOICE] Local TTS synthesis failed: {str(e)}", exc_info=True)
            return b""
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
