from fastapi import APIRouter, status, UploadFile, File, Response, HTTPException
from pydantic import BaseModel, Field
from app.services.voice_service import VoiceService

router = APIRouter(prefix="/voice", tags=["Voice Engine"])

class SynthesisRequest(BaseModel):
    text: str = Field(..., example="Hello! How can I assist you with your appointment today?")

@router.post(
    "/transcribe",
    status_code=status.HTTP_200_OK,
    summary="Local Whisper Speech-to-Text Transcribe",
    description="Transcribe uploaded microphone audio file using local Whisper STT engine."
)
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe uploaded audio file to text."""
    if not file:
        raise HTTPException(status_code=400, detail="No audio file uploaded.")
    
    audio_bytes = await file.read()
    text = await VoiceService.transcribe_audio(audio_bytes, file.filename or "audio.webm")
    return {"success": True, "text": text}


@router.post(
    "/synthesize",
    status_code=status.HTTP_200_OK,
    summary="Local TTS Speech Synthesize",
    description="Convert AI receptionist text response to WAV audio stream using local TTS engine."
)
async def synthesize_speech(req: SynthesisRequest):
    """Synthesize text into WAV audio stream."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text parameter cannot be empty.")

    wav_bytes = await VoiceService.synthesize_speech(req.text)
    if not wav_bytes:
        raise HTTPException(status_code=500, detail="Voice synthesis failed.")

    return Response(content=wav_bytes, media_type="audio/wav")
