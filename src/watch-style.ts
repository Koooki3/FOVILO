export const recommendationsSelector = '#secondary-inner > #related';
export const cinemaStageSelector = '#primary-inner > #player';

export const watchStyles = `
  [data-fovilo-watch] { color-scheme: light; }
  html[dark] [data-fovilo-watch] { color-scheme: dark; }

  ytd-watch-flexy #above-the-fold:has(> [data-fovilo-watch]) #title h1 {
    font-size: clamp(20px, 1.9vw, 24px);
    font-weight: 700;
    line-height: 1.25;
    text-wrap: pretty;
  }

  ytd-watch-flexy #above-the-fold:has(> [data-fovilo-watch]) #title h1 > yt-formatted-string {
    font: inherit;
  }

  ytd-watch-flexy #above-the-fold:has(> [data-fovilo-watch]) #owner #channel-name a {
    font-weight: 600;
  }

  ytd-watch-flexy #above-the-fold:has(> [data-fovilo-watch]) #description-inner #info {
    font-weight: 400;
  }

  ytd-watch-flexy:not([is-live]):has(${recommendationsSelector})
    #above-the-fold > [data-fovilo-watch][data-fovilo-modes-available] {
    --fovilo-focus-display: inline-block;
  }

  ytd-watch-flexy:not([is-live]):has(${cinemaStageSelector} #movie_player)
    #above-the-fold > [data-fovilo-watch][data-fovilo-modes-available] {
    --fovilo-cinema-display: inline-block;
  }

  ytd-watch-flexy:not([is-live]):has(#above-the-fold > [data-fovilo-mode="focus"], #above-the-fold > [data-fovilo-mode="cinema"])
    ${recommendationsSelector} {
    display: none;
  }

  html:not(:has(:fullscreen))
    ytd-watch-flexy:not([is-live], [theater]):has(#above-the-fold > [data-fovilo-mode="cinema"])
    ${cinemaStageSelector}:has(#movie_player) {
    --fovilo-cinema-matte: #141519;
    background-color: var(--fovilo-cinema-matte);
    box-shadow: 0 0 0 clamp(3px, 0.6vw, 8px) var(--fovilo-cinema-matte);
  }
`;
