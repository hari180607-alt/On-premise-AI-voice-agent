import logging
import os
import tempfile
import asyncio
import pyttsx3
import whisper
from typing import Dict, Any, Optional

logger = logging.getLogger("uvicorn.error")

_whisper_model = None

def get_whisper_model():
    """Lazy load lightweight local Whisper model."""
    global _whisper_model
    if _whisper_model is None:
        logger.info("Loading local Whisper model (tiny.en)...")
        _whisper_model = whisper.load_model("tiny.en")
        logger.info("Local Whisper model loaded successfully.")
    return _whisper_model


class VoiceService:
    """Service layer handling local offline Whisper Speech-to-Text and TTS Speech Synthesis."""

    @classmethod
    async def transcribe_audio(cls, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        """Transcribe uploaded audio file using local Whisper model."""
        if not audio_bytes or len(audio_bytes) < 100:
            return ""

        ext = os.path.splitext(filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            model = get_whisper_model()
            # Run Whisper transcription in threadpool executor to avoid blocking event loop
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                None,
                lambda: model.transcribe(tmp_path, fp16=False)
            )
            text = result.get("text", "").strip()
            logger.info(f"Local Whisper Transcribed ({len(audio_bytes)} bytes): '{text}'")
            return text
        except Exception as e:
            logger.error(f"Whisper transcription failed: {str(e)}")
            return ""
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
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
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: _generate_wav(tmp_path, clean_text))

            with open(tmp_path, "rb") as f:
                wav_bytes = f.read()
            return wav_bytes
        except Exception as e:
            logger.error(f"Local TTS synthesis failed: {str(e)}")
            return b""
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
