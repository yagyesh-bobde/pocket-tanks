# Reference and research record

Accessed 10 November 2026. The selected reference is the **classic PC 800 × 600 edition**, as shown in Blitwise's original product gallery. It is a coherent source set: all six gallery images share the same black/purple scene, green terrain, silver controls, purple/gold logo, and four-move HUD. The title image identifies itself as v1.00. Later mobile UI is intentionally not mixed into this reference.

## Primary references

- [Blitwise classic product page](https://classic.blitwise.com/ptanks.html): original description, weapon shop, target practice, and six full-size screenshots.
- [Current official product page](https://www.blitwise.com/pocket-tanks): corroborates angle/power play, weapon shop, target practice, and the distinction between classic LAN and mobile online play.
- [Classic support page](https://classic.blitwise.com/support.html): confirms the original 800 × 600 display mode.

The original JPEGs are preserved locally under `reference/` (ignored by git). Original screenshots are **not used by the game renderer**. Comparison PNGs contain attributed excerpts of those screenshots for visual review; they are not covered by this project's MIT license.

| Local reference | Official image URL | Purpose |
| --- | --- | --- |
| `reference/titlescreen.jpg` | https://classic.blitwise.com/ptanks/pt_titlescreen.jpg | Logo, typography, title bands, corner scores |
| `reference/player1.jpg` | https://classic.blitwise.com/ptanks/pt_player1.jpg | Player setup, swatches, Continue, inactive HUD |
| `reference/weaponshop.jpg` | https://classic.blitwise.com/ptanks/pt_weaponshop.jpg | Twenty-weapon shop and alternating picks |
| `reference/spider.jpg` | https://classic.blitwise.com/ptanks/pt_spider.jpg | Mountain terrain, aiming HUD, web/impact effect |
| `reference/hailstorm.jpg` | https://classic.blitwise.com/ptanks/pt_hailstorm.jpg | Valley terrain, blue flowing ice effect |
| `reference/tommygun.jpg` | https://classic.blitwise.com/ptanks/pt_tommygun.jpg | Cliff terrain, ballistic bullet burst |

The official gallery contains **no results screen**. Our results and mobile screenshots are supplied separately and have no invented original counterpart or likeness score.

## Rules and weapon research

- [REIKANE_6379 / Sao Li Zhou, Pocket Tanks FAQ, 19 May 2003, GameFAQs](https://gamefaqs.gamespot.com/pc/582344-pocket-tanks/faqs/22955): directly read in the browser. Confirms a random pool of twenty weapons, alternate picks to ten each, Randomize, four moves per player, ten volleys, gain points for opponent hits, lose points for self-hits, unlimited target practice, terrain types, default no wind, 360° aiming, and original keyboard controls. Also describes all thirty shareware weapons and approximate direct-hit points.
- [Gerarge, Weapon Info, Speedrun.com](https://www.speedrun.com/ptanks/guides/5g347): corroborates differences among the original thirty weapons, including directional dirt removal, proximity bursts, tunnelling, rolling, liquid/bouncing effects, dirt building, and rapid fire. Descriptions in the game are newly written paraphrases.
- [Pocket Tanks, Wikipedia](https://en.wikipedia.org/wiki/Pocket_Tanks): secondary corroboration of the 2001 release, scoring, ten volleys, four moves, and destructible terrain. Its citation warnings mean it was not treated as the sole rules source.
- A Neoseeker FAQ was attempted but blocked by a security check and was not used as evidence.

## Reconstruction choices

No original executable, source code, data file, font, sprite, logo bitmap, soundtrack, or sound sample was extracted. Physics, terrain, UI, synthesized sounds, and illustrations are implemented independently. The FAQ establishes behavior; it does not supply an exact numerical simulation. Ballistics, falloff, effect particle counts, terrain collapse, and CPU accuracy are therefore approximations, documented in the README.

For screenshot review, `src/review-scenes.js` contains measured and simplified terrain silhouette coordinates. These are **review fixtures only**, reached with `?review=1`; ordinary matches generate independent seeded terrain. Effect frames run the real effect simulation at fixed times. The comparison scene fixes names, scores, angles, and powers to the reference. It is a reproducible visual test, not a claim that random live matches generate the same hills.

The shared preview browser was used for research and the first two screenshot iterations. It repeatedly timed out during the final capture pass; the final images and repeatable UI checks use local Playwright Chromium. Browser screenshots from the first passes were converted from their embedded ICC profile to sRGB before pairing. Captures are cropped to the game's 800 × 600 stage, with no painted-over controls or fabricated original frames.

## Movement, aiming, and network update

The follow-up retains the classic visual reference while adding a **thumbwheel / scrubber**, as requested. The [official iPad screenshot](https://images.squarespace-cdn.com/content/v1/5e0ced62f6901c542d06a321/1580944983109-1638HC3PYES14S34AHIN/ptf_ipadpro_1.png?format=1000w), opened from the current official product page, corroborates the Angle value and power-bar arrangement. A still image cannot establish its drag behavior. The new ridged scrolling picker is our interaction design, not a claim to have recovered proprietary mobile control code. Both the battlefield turret and value respond during the gesture.

The official current product page explicitly distinguishes mobile Wi-Fi/online play from classic PC/Mac LAN play. Our browser remake uses [PeerJS's documented data connections](https://peerjs.com/client/getting-started) and the [documented free cloud signaling service and NAT limits](https://peerjs.com/client/faq). The cloud finds peers; the authoritative host sends game state directly over WebRTC. There is no hosted game backend and no TURN relay. A local PeerServer CLI is included for optional LAN signaling and deterministic connection tests.

Validation uses an independent analytic gravity/wind check and 144 first-impact comparisons (three terrains × three wind values × two sides × eight angle/power pairs, including downward and horizontal shots). Prediction and ordinary live shots share launch geometry, exact constant-acceleration integration, a 120 Hz step, and swept terrain/tank collision. Homing and special weapon effects intentionally diverge from a basic ballistic path. Physical tank movement is tested at intermediate positions, on slopes and across narrow obstructions.

Two independent Chromium browser contexts complete a twenty-shot match over actual WebRTC data channels, with alternating draft, turn enforcement, live aim, movement by both players, terrain/score agreement, disconnect/rejoin, and rematch. Invalid room codes and occupied seats are tested separately. A further smoke test connected via the public PeerJS cloud and completed a shot at normal speed. These are two browser clients on this development machine; testing on two physical devices across arbitrary routers is not claimed.
