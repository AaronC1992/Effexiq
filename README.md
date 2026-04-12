<div align="center">

# Effexiq

### Intelligent Audio Companion for Tabletop RPGs

AI-powered ambient sound designer that listens to your game in real time and automatically plays contextually-appropriate music and sound effects.

<br>

[![Play Now](https://img.shields.io/badge/Play%20Now-Effexiq-8a2be2?style=for-the-badge&logoColor=white)](https://effexiq.vercel.app)

<br>

</div>

---

## The Problem

Tabletop RPG game masters spend hours curating playlists and manually triggering sound effects mid-session. It breaks immersion, splits focus, and most groups just skip audio entirely.

## The Solution

Effexiq listens to what's happening at the table and **automatically** plays the right sounds at the right time — no manual input needed.

- A player says *"I kick down the tavern door"* — tavern ambiance fades in
- The DM describes a thunderstorm — rain and thunder start rolling
- Combat breaks out — the music shifts to battle drums

The GM stays in the story. The players stay immersed. The audio just works.

## How It Works

Effexiq uses **speech recognition** to capture live conversation, sends it through an **AI analysis layer** (GPT-4o-mini), and maps the output to a curated library of **450+ sound effects and ambient tracks** — all in real time.

```
Voice Input → Speech Recognition → AI Context Analysis → Sound Matching → Playback
```

### Key Capabilities

| Feature | Description |
|---|---|
| **Auto-Detect Mode** | Listens to live speech and triggers sounds automatically via AI |
| **Story Mode** | Pre-written narrative scenes with timed audio cues |
| **Sound Library** | 450+ categorized sounds — ambient, combat, weather, creatures, music |
| **Control Board** | Manual triggers for GMs who want direct control alongside auto-detect |
| **Smart Layering** | Multiple sounds play simultaneously with intelligent volume balancing |
| **Instant Response** | Sub-second latency from spoken word to audio playback |

## Market Opportunity

The tabletop RPG market has grown into a **$2B+ industry** (2025), fueled by actual-play content (Critical Role, Dimension 20) and the mainstreaming of D&D. Supporting tools — VTTs, digital maps, audio — are a fast-growing adjacent segment.

**No product on the market offers real-time, voice-reactive audio.**

Current alternatives require manual playlist management (Syrinscape, Tabletop Audio) or pre-configured triggers. Effexiq is the first to close the loop between spoken narrative and dynamic audio — zero-touch.

### Target Users

- **Game Masters** running in-person or online TTRPG sessions
- **Actual-play streamers & podcasters** looking for production-quality audio
- **Game cafes & event organizers** hosting RPG nights
- **LARP & immersive experience designers**

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19 |
| **Audio Engine** | Howler.js — custom engine with layering, fading, preloading |
| **AI Analysis** | OpenAI GPT-4o-mini (server-side) |
| **Speech Recognition** | Web Speech API (native browser) |
| **Database** | Supabase (PostgreSQL) |
| **Media Storage** | Cloudflare R2 (450+ audio files via CDN proxy) |
| **Hosting** | Vercel (serverless, edge-optimized) |

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Browser Client                  │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Speech   │→│    AI     │→│  Sound Engine   │  │
│  │  Input    │  │ Director  │  │  (Howler.js)   │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
│                      ↕                             │
└──────────────────────┼─────────────────────────────┘
                       │ API
          ┌────────────┼────────────┐
          │            │            │
    ┌─────▼─────┐ ┌───▼────┐ ┌───▼────┐
    │  OpenAI   │ │Supabase│ │  R2    │
    │  GPT-4o   │ │  (DB)  │ │ (CDN)  │
    └───────────┘ └────────┘ └────────┘
```

## Traction & Status

- **Fully functional product** — live and playable today
- **450+ curated sound assets** hosted on CDN
- **AI pipeline operational** — real-time analysis with sub-second response
- **Zero-config user experience** — open the app and press play

## Business Model (Planned)

| Tier | Price | Features |
|---|---|---|
| **Free** | $0 | Core auto-detect, limited sound library |
| **Pro** | $8/mo | Full library, story mode, custom sounds, priority AI |
| **Table License** | $20/mo | Multi-device sync, shared sessions, commercial use |

## Roadmap

- **Multi-device sync** — shared audio across a full table of players
- **Custom sound uploads** — bring your own audio library
- **VTT integrations** — Foundry VTT, Roll20, Owlbear Rodeo
- **Mobile companion app** — control board from your phone
- **Community marketplace** — user-created sound packs and story scenes

## Get in Touch

Interested in Effexiq? Reach out:

- **Live Demo:** [effexiq.vercel.app](https://effexiq.vercel.app)
- **GitHub:** [AaronC1992/Effexiq](https://github.com/AaronC1992/Effexiq)

---

<div align="center">

Built by **Aaron C.** — solo developer, game master, and audio nerd.

</div>
