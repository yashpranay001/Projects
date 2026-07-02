import os
from flask import Flask, request, jsonify, render_template, Response, stream_with_context, session, redirect, url_for
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = "botbuddy-secret-key"


client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """You are Sunny — a warm, friendly, and knowledgeable AI assistant.
Your personality is like a kind, patient friend who happens to know a lot about everything.
- Keep responses clear, helpful, and conversational
- Use a warm and encouraging tone
- Be concise but thorough — don't over-explain
- When appropriate, use gentle humor
- If you don't know something, say so honestly and helpfully
- Always make the user feel heard and supported"""

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        if username == "admin" and password == "12345":
            session["user"] = username
            return redirect(url_for("index"))

        return render_template("login.html", error="Invalid username or password")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("login"))

@app.route("/")
def index():
    if "user" not in session:
        return redirect(url_for("login"))

    return render_template("index.html")



def convert_messages_for_gemini(messages):
    gemini_messages = []

    for message in messages:
        role = message.get("role", "user")
        content = message.get("content", "")

        gemini_role = "model" if role == "assistant" else "user"

        if isinstance(content, list):
            text = "\n".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )
        else:
            text = str(content)

        gemini_messages.append({
            "role": gemini_role,
            "parts": [{"text": text}]
        })

    return gemini_messages


@app.route("/chat", methods=["POST"])
def chat():
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    messages = data.get("messages", [])


    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    gemini_messages = convert_messages_for_gemini(messages)

    def generate():
        response = client.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=gemini_messages,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=1024,
            ),
        )

        for chunk in response:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"

        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
