# Design direction v0

Keep native content first. The Watch slice places a compact control in normal document flow with semantic buttons, a live status and a keyboard-accessible manual link. Browser system colors support light, dark and forced-colors settings. The slice adds no animation. Popup settings use standard checkbox semantics.

Validate visible focus, narrow layouts, long translations and zoom before adopting a wider token system. Later mode transitions should make layout changes legible and respect reduced motion.

## Everyday on Watch

The title leads with a responsive 20–24 px size and a 700 weight. The channel label uses 600 and the views/date row uses 400. All three stay in the original YouTube layout and keep the site's text colors. The controls follow the appearance selected on YouTube. The stylesheet is attached to the Watch host so disabling the enhancement removes the typography changes with the controls.

## Focus on Watch

Focus is a video-scoped toggle for regular Watch pages with the expected recommendations container. It hides the recommendations subtree through the owned stylesheet and leaves the player, comments, and sibling sections in their native layout. The button retains its name and exposes its pressed state. Feedback uses a separate row so its appearance leaves the controls in place. Video changes and playlist routes reset the toggle. The layout stays static during the switch.

## Cinema on Watch

Cinema adds a dark matte around the existing inline player and hides the same recommendation subtree as Focus. The matte uses a spread shadow and leaves the player dimensions and hit targets intact. The native theater and fullscreen layouts take precedence. The controls expose one active mode at a time. Selecting the active mode again returns to Everyday. The first version applies the matte instantly.

## Context Rail on Watch

The inline rail groups time links and viewing modes behind a **Watch controls** disclosure. It starts expanded and preserves the user's choice across navigation in the same YouTube document. The controls wrap in narrow layouts. When collapsed, the disclosure names an active Focus or Cinema mode and **Return to YouTube** remains available. The disclosure has an explicit expanded state and removes hidden actions from the keyboard sequence. The rail stays in the metadata flow below the player.

## Context Rail on Search

The same rail sits at the start of the primary results column. Compact density reduces the spacing before regular video results to 8 px and limits wide thumbnails to 360 px at viewports of at least 1000 CSS px. The Search controls leave native filters, cards and result links in place. Density and disclosure choices last within the current YouTube document. Disabling Search removes the rail and its scoped stylesheet.

## Context Rail on Home

The Home rail appears above the native feed, including the signed-out empty state. It links to YouTube's Subscriptions page with a standard anchor and shares the Search rail's disclosure and recovery behavior. It uses a separate popup switch.

## Commands

Each rail exposes the same keyboard-accessible **Commands** launcher, including when the rail is collapsed. The dialog opens with focus on search. It lists actions for the current surface and checks capability before executing. Commands reuse the visible controls' operation handlers. Escape restores the launcher's focus or the prior focus for a browser shortcut. Route disposal closes the dialog. The browser owns shortcut assignment, and FOVILO ships the command unbound.

Recent command selection is stored as up to six command IDs in the current document. The panel shows matching, available recent commands first, newest first, followed by the other commands. Keyboard order follows the same sequence. The global recovery action remains in the regular list so a prior shutdown does not promote it.
