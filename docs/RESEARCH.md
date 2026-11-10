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
