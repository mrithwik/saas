import os
from pathlib import Path
from fastapi import FastAPI, Depends, UploadFile, File  # type: ignore
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse  # type: ignore
from fastapi.staticfiles import StaticFiles  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials  # type: ignore
from openai import OpenAI  # type: ignore

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clerk authentication
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)


# ── Models ────────────────────────────────────────────────────────────────────

class Visit(BaseModel):
    patient_name: str
    date_of_visit: str
    notes: str


class TranslationRequest(BaseModel):
    text: str
    target_language: str


# ── Prompts ───────────────────────────────────────────────────────────────────

system_prompt = """
You are provided with notes written by a doctor from a patient's visit.
Your job is to summarize the visit for the doctor and provide an email.
Reply with exactly three sections with the headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient in patient-friendly language
"""


def user_prompt_for(visit: Visit) -> str:
    return f"""Create the summary, next steps and draft email for:
Patient Name: {visit.patient_name}
Date of Visit: {visit.date_of_visit}
Notes:
{visit.notes}"""


# ── API Routes ────────────────────────────────────────────────────────────────

@app.post("/api/consultation")
def consultation_summary(
    visit: Visit,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    """Stream AI-generated consultation summary, next steps, and patient email."""
    user_id = creds.decoded["sub"]
    client = OpenAI()

    prompt = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(visit)},
    ]

    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=prompt,
        stream=True,
    )

    def event_stream():
        for chunk in stream:
            text = chunk.choices[0].delta.content
            if text:
                lines = text.split("\n")
                for line in lines[:-1]:
                    yield f"data: {line}\n\n"
                    yield "data:  \n"
                yield f"data: {lines[-1]}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    """
    Transcribe a doctor's audio dictation using OpenAI Whisper.
    Accepts any audio format supported by Whisper (webm, mp4, mp3, wav, m4a).
    """
    client = OpenAI()

    audio_bytes = await audio.read()

    transcription = client.audio.transcriptions.create(
        model="whisper-1",
        file=(audio.filename or "recording.webm", audio_bytes, audio.content_type or "audio/webm"),
        response_format="text",
    )

    return JSONResponse({"transcript": transcription})


@app.post("/api/translate")
async def translate_letter(
    request: TranslationRequest,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    """Translate the patient email into the requested language, streamed."""
    client = OpenAI()

    translation_prompt = [
        {
            "role": "system",
            "content": (
                "You are a professional medical translator. "
                "Translate the following patient letter into the requested language. "
                "Preserve the friendly, clear tone appropriate for a patient. "
                "Output only the translated letter with no preamble or explanation."
            ),
        },
        {
            "role": "user",
            "content": f"Translate this letter into {request.target_language}:\n\n{request.text}",
        },
    ]

    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=translation_prompt,
        stream=True,
    )

    def event_stream():
        for chunk in stream:
            text = chunk.choices[0].delta.content
            if text:
                lines = text.split("\n")
                for line in lines[:-1]:
                    yield f"data: {line}\n\n"
                    yield "data:  \n"
                yield f"data: {lines[-1]}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/health")
def health_check():
    """Health check endpoint for AWS App Runner."""
    return {"status": "healthy"}


# ── Static files — MUST BE LAST ───────────────────────────────────────────────

static_path = Path("static")
if static_path.exists():
    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")

    app.mount("/", StaticFiles(directory="static", html=True), name="static")