export const recommendationsSelector = '#secondary-inner > #related';

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
    #above-the-fold > [data-fovilo-watch][data-fovilo-focus-available] {
    --fovilo-focus-display: inline-block;
  }

  ytd-watch-flexy:not([is-live]):has(#above-the-fold > [data-fovilo-watch][data-fovilo-focus])
    ${recommendationsSelector} {
    display: none;
  }
`;
