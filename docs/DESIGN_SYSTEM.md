# Design direction v0

Keep native content first. The Watch slice places a compact control in normal document flow with semantic buttons, a live status and a keyboard-accessible manual link. Browser system colors support light, dark and forced-colors settings. The slice adds no animation. Popup settings use standard checkbox semantics.

Validate visible focus, narrow layouts, long translations and zoom before adopting a wider token system. Later mode transitions should make layout changes legible and respect reduced motion.

## Everyday on Watch

The title leads with a responsive 20–24 px size and a 700 weight. The channel label uses 600 and the views/date row uses 400. All three stay in the original YouTube layout and keep the site's text colors. The controls follow the appearance selected on YouTube. The stylesheet is attached to the Watch host so disabling the enhancement removes the typography changes with the controls.

## Focus on Watch

Focus is a video-scoped toggle for regular Watch pages with the expected recommendations container. It hides the recommendations subtree through the owned stylesheet and leaves the player, comments, and sibling sections in their native layout. The button retains its name and exposes its pressed state. Feedback uses a separate row so its appearance leaves the controls in place. Video changes and playlist routes reset the toggle. The layout stays static during the switch.

## Cinema on Watch

Cinema adds a dark matte around the existing inline player and hides the same recommendation subtree as Focus. The matte uses a spread shadow and leaves the player dimensions and hit targets intact. The native theater and fullscreen layouts take precedence. The controls expose one active mode at a time. Selecting the active mode again returns to Everyday. The first version applies the matte instantly.
