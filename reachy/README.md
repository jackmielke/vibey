# Vibey on Reachy Mini 🤖🎙️

This folder gives Vibey a **physical body + voice** using Pollen Robotics' official
[Reachy Mini conversation app](https://github.com/pollen-robotics/reachy_mini_conversation_app).
We don't fork or rewrite that app — we just drop in a **Vibey personality profile** so the
stock voice-to-voice app speaks and acts like Vibey.

> You have the **Reachy Mini Lite** (the USB / wired-to-laptop version). It is *not* battery
> powered, so it needs **wall power through its USB cable**, and the control software (the
> "daemon") runs on **your laptop**, not on the robot.

---

## One-time setup

Run all of this in a terminal **on the laptop the robot is plugged into.**

### 1. Install `uv` and the SDK
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # skip if you already have uv
uv pip install "reachy-mini"
```

### 2. Start the daemon (this powers the motors, mic, and speaker)
Plug the robot in (USB + wall power), then:
```bash
reachy-mini-daemon
```
Leave this running. Sanity-check it:
- Status dashboard: <http://localhost:8000/>  (toggle the robot on/off, run basic moves)
- API docs: <http://localhost:8000/docs>

### 3. Confirm the hardware is alive
In a **second** terminal, save `hello.py`:
```python
from reachy_mini import ReachyMini
with ReachyMini() as mini:
    print("Connected!")
    mini.goto_target(antennas=[0.5, -0.5], duration=0.5)
    mini.goto_target(antennas=[-0.5, 0.5], duration=0.5)
    mini.goto_target(antennas=[0, 0], duration=0.5)
```
```bash
python hello.py
```
Antennas wiggle → hardware + daemon are good.

### 4. Install the conversation app
```bash
git clone https://github.com/pollen-robotics/reachy_mini_conversation_app
cd reachy_mini_conversation_app
uv venv --python python3.12 .venv && source .venv/bin/activate
uv sync
```

### 5. Install the Vibey profile
Copy this profile into the app so it shows up as a selectable personality:
```bash
# from inside the reachy_mini_conversation_app folder:
cp -R /path/to/vibey/reachy/profiles/vibey \
      src/reachy_mini_conversation_app/profiles/vibey
```
(`/path/to/vibey` = wherever you cloned this repo.)

### 6. Configure env
```bash
cp .env.example .env
```
Then either copy the values from [`conversation-app.env.example`](./conversation-app.env.example)
in this folder, or just add this one line to `.env` to auto-load Vibey at startup:
```
REACHY_MINI_CUSTOM_PROFILE=vibey
```
The **default LLM backend is Hugging Face and needs no API key.** Want a snappier realtime
voice? Set `BACKEND_PROVIDER=openai` (+ `OPENAI_API_KEY`) or `gemini` (+ `GEMINI_API_KEY`).

---

## Run it

```bash
reachy-mini-conversation-app --ui
```
Talk to Vibey out loud — it listens on the robot's mic, thinks, replies through the speaker,
and moves its head/antennas as it talks. The `--ui` flag opens a web page where you can pick
the **vibey** profile, voice, and settings, then save it as the startup default. If you set
`REACHY_MINI_CUSTOM_PROFILE=vibey`, it loads Vibey automatically.

Useful flags:
- `--no-camera` — run without vision
- `--head-tracker mediapipe` — track and look at whoever's talking
- `--local-vision` — run the vision model locally instead of via the backend

---

## What Vibey can do with its body

The app's LLM can already call these built-in tools (no extra code needed):
`move_head`, `head_tracking`, `dance`, `stop_dance`, `play_emotion`, `stop_emotion`,
`camera`, `remember`, `forget`, `idle_do_nothing`. The Vibey profile's instructions tell it
to use them expressively — nodding, perking antennas, dancing when hyped.

---

## Tuning the personality

Everything Vibey says and does is driven by [`profiles/vibey/instructions.md`](./profiles/vibey/instructions.md).
Edit that file, re-copy it into the app, and restart — no code changes. Keep instructions
written for **speech** (short, plain, no markdown), since every reply is spoken aloud.

To gate which *remote* (Hugging Face Space) tools a profile may use, add a `tools.txt` next to
`instructions.md` listing allowed tool IDs. We don't ship one, so Vibey just uses the built-in
body tools above. Install more with:
```bash
reachy-mini-conversation-app tool-spaces add <owner/space-name> --profile vibey
```

---

## Notes & limits

- This profile is a **voice-tuned copy** of Vibey's real system prompt (from the `agents` table
  in the Vibe Supabase project), adapted for a body and for talking out loud.
- The stock app uses its **own** memory (`remember`/`forget`), *not* Vibey's Supabase
  `memories` / community brain. Wiring the robot into Vibey's actual brain + memories is a
  bigger "custom Vibey body app" — a deliberate next step, not part of this stock-app config.

Sources: [conversation app](https://github.com/pollen-robotics/reachy_mini_conversation_app) ·
[SDK](https://github.com/pollen-robotics/reachy_mini) ·
[quickstart](https://huggingface.co/docs/reachy_mini/SDK/quickstart)
